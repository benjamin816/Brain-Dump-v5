
import React from 'react';

export default function Home() {
  return (
    <main style={{ padding: '4rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>🧠 BrainDump API</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Backend service is active.</p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <code style={{ background: '#1e293b', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>/api/inbox</code>
        <code style={{ background: '#1e293b', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>/api/entries</code>
      </div>
    </main>
  );
}
