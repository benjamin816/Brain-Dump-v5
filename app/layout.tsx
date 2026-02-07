
import React from 'react';

export const metadata = {
  title: 'Brain Dump API',
  description: 'Backend for iPhone Shortcut notes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#0f172a', color: '#f8fafc' }}>{children}</body>
    </html>
  );
}
