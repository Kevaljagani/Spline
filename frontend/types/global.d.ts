declare global {
  namespace JSX {
    interface IntrinsicElements {
      input: React.DetailedHTMLProps<
        React.InputHTMLAttributes<HTMLInputElement> & {
          webkitdirectory?: string;
        },
        HTMLInputElement
      >;
    }
  }
}

export {};