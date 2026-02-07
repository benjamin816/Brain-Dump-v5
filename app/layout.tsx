
import React from 'react';
import './globals.css';

export const metadata = {
  title: 'BRAINDUMP | Intelligent Notes',
  description: 'AI-powered second brain for high performance note taking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="bg-[#020617] text-slate-100 antialiased font-inter">
        {children}
      </body>
    </html>
  );
}
