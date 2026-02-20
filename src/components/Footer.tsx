import { Disclaimer } from './Disclaimer';

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card/50 py-6 px-4 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center space-y-4">
        <Disclaimer />
        <p className="text-[10px] text-muted-foreground/60">
          © {new Date().getFullYear()} TellMeMore. Built with{' '}
          <a
            href="https://oflix-lac.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary transition-colors"
          >
            OfliX
          </a>
          .
        </p>
      </div>
    </footer>
  );
}