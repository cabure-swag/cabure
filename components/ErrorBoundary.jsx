// components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, errorInfo) {
    // Podés conectar esto a un logger si querés
    this.setState({ stack: errorInfo?.componentStack || "" });
    if (typeof window !== "undefined") {
      // útil para debugs rápidos
      console.error("ErrorBoundary:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>Ocurrió un error en la página</h1>
          <p>{this.state.message}</p>
          {process.env.NODE_ENV !== "production" && this.state.stack ? (
            <pre style={{ whiteSpace: "pre-wrap", background:"#0E1012", padding:12, borderRadius:8 }}>
              {this.state.stack}
            </pre>
          ) : null}
          <a href="/" className="btn" style={{ display:"inline-block", marginTop:12 }}>Volver al inicio</a>
        </div>
      );
    }
    return this.props.children;
  }
}
