import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GuestProvider, useGuestStatus } from "@/contexts/GuestContext";
import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { IncomingCallModal } from "@/components/video/IncomingCallModal";
import { VideoCall } from "@/components/video/VideoCall";
import { NavBar } from "@/components/NavBar";
import { GuestBanner } from "@/components/GuestBanner";
import { Footer } from "@/components/Footer";
import { useState } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Messages from "./pages/Messages";
import Groups from "./pages/Groups";
import Posts from "./pages/Posts";
import Settings from "./pages/Settings";
import GroupDetail from "./pages/GroupDetail";
import Wellness from "./pages/Wellness";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import { Terms } from "@/components/Terms";
import { Privacy } from "@/components/Privacy";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isGuest } = useGuestStatus();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (user && !isGuest) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── Incoming Call Handler ────────────────────────────────────────────────────
// Rendered LAST inside the provider tree so it always paints above everything.
// IncomingCallModal uses createPortal → appended to document.body, escaping
// all stacking contexts created by NavBar / AppLayout backdrop-blur transforms.

function IncomingCallHandler() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const { incomingCall, acceptCall, declineCall } = useIncomingCalls(user?.id);
  const [activeCall, setActiveCall] = useState<{
    sessionId: string;
    callerId: string;
    callerName: string;
    callerInstitution?: string;
  } | null>(null);

  if (isGuest) return null;

  if (activeCall && user) {
    return (
      <VideoCall
        currentUserId={user.id}
        remoteUserId={activeCall.callerId}
        callSessionId={activeCall.sessionId}
        isCaller={false}
        remoteName={activeCall.callerName}
        remoteInstitution={activeCall.callerInstitution}
        onEnd={() => setActiveCall(null)}
      />
    );
  }

  if (!incomingCall) return null;

  return (
    <IncomingCallModal
      callerName={incomingCall.callerName}
      callerInstitution={incomingCall.callerInstitution}
      onAccept={() => {
        const call = acceptCall();
        if (call) {
          setActiveCall({
            sessionId: call.id,
            callerId: call.caller_id,
            callerName: call.callerName,
            callerInstitution: call.callerInstitution,
          });
        }
      }}
      onDecline={declineCall}
    />
  );
}

// ─── App Layout ───────────────────────────────────────────────────────────────

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col min-h-screen">
      {user && <NavBar />}
      {user && <GuestBanner />}
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

// ─── Inner app — needs auth/guest context so lives inside providers ───────────

function InnerApp() {
  return (
    <>
      {/* Page layout + routes */}
      <AppLayout>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
          <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
          <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
          <Route path="/wellness" element={<ProtectedRoute><Wellness /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>

      {/* Incoming call handler rendered AFTER AppLayout so it's
          highest in paint order. IncomingCallModal uses createPortal
          so it escapes backdrop-blur stacking contexts entirely. */}
      <IncomingCallHandler />
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <GuestProvider>
              <InnerApp />
            </GuestProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;