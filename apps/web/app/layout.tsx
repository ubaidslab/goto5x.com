export const metadata = {
  title: "goto5x.com",
  description: "goto5x.com - Module 1 scaffolding (bare functional UI, no design pass yet)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
        {children}
      </body>
    </html>
  );
}
