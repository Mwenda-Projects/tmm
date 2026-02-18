import { Link } from 'react-router-dom';

export function Disclaimer() {
  return (
    <div className="text-[11px] sm:text-xs text-muted-foreground/80 leading-relaxed select-none text-center max-w-2xl mx-auto">
      <p className="font-medium mb-1 text-muted-foreground">Medical Disclaimer</p>
      <p>
        TellMeMore is a peer collaboration platform and does not provide medical, clinical, 
        or professional counseling services. This platform is not intended for crisis 
        intervention. If you are in immediate danger, please contact your local 
        emergency services or a qualified healthcare professional.
      </p>
      <div className="mt-3 flex items-center justify-center gap-4">
        <Link 
          to="/terms" 
          className="underline underline-offset-4 hover:text-primary transition-colors decoration-muted-foreground/30"
        >
          Terms of Service
        </Link>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
        <Link 
          to="/privacy" 
          className="underline underline-offset-4 hover:text-primary transition-colors decoration-muted-foreground/30"
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}