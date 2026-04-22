import React, { useState, useEffect } from 'react';
import { supabase, getActivePoll, vote } from '../lib/supabase';
import { CheckCircle2, MessageSquare, Loader2, Send } from 'lucide-react';

export default function PublicView() {
  const [activePoll, setActivePoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wordInputs, setWordInputs] = useState([]);

  useEffect(() => {
    loadActivePoll();

    const channel = supabase
      .channel('poll-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => loadActivePoll()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const loadActivePoll = async () => {
    setLoading(true);
    const { data } = await getActivePoll();
    setActivePoll(data);

    if (data) {
      const hasVoted = localStorage.getItem(`voted_${data.id}`);
      setVoted(!!hasVoted);
      // Initialize word inputs if text poll
      if (data.type === 'text') {
        setWordInputs(Array(Number(data.max_words) || 1).fill(''));
      }
    }
    setLoading(false);
  };

  // Multiple choice vote
  const handleVote = async (index) => {
    if (voted || submitting) return;
    setSubmitting(true);
    const { error } = await vote(activePoll.id, index);
    if (!error) {
      localStorage.setItem(`voted_${activePoll.id}`, 'true');
      setVoted(true);
    } else {
      alert('Kunde inte registrera din röst. Försök igen.');
    }
    setSubmitting(false);
  };

  // Text vote — one insert per word
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (voted || submitting) return;

    const words = wordInputs.map(w => w.trim().toLowerCase()).filter(Boolean);
    if (words.length === 0) {
      alert('Skriv minst ett ord!');
      return;
    }

    setSubmitting(true);
    // Insert one row per word — omit option_index so DB default/null applies
    const rows = words.map(w => ({ poll_id: activePoll.id, text_response: w }));
    const { error } = await supabase.from('votes').insert(rows);

    if (!error) {
      localStorage.setItem(`voted_${activePoll.id}`, 'true');
      setVoted(true);
    } else {
      alert('Kunde inte skicka ditt svar. Försök igen.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-blue)" />
      </div>
    );
  }

  if (!activePoll) {
    return (
      <div className="glass-card animate-fade" style={{ textAlign: 'center', marginTop: '10vh' }}>
        <MessageSquare size={64} color="var(--text-secondary)" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
        <h1>Ingen aktiv fråga just nu</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
          Vänta tills presentatören startar en ny fråga. Sidan uppdateras automatiskt.
        </p>
      </div>
    );
  }

  if (voted) {
    return (
      <div className="glass-card animate-fade" style={{ textAlign: 'center', marginTop: '10vh' }}>
        <CheckCircle2 size={64} color="#10b981" style={{ marginBottom: '1.5rem' }} />
        <h1>Tack för ditt svar!</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
          Håll ögonen på storskärmen för att se resultatet i realtid.
        </p>
        <button
          onClick={() => {
            localStorage.removeItem(`voted_${activePoll.id}`);
            setVoted(false);
            if (activePoll.type === 'text') {
              setWordInputs(Array(Number(activePoll.max_words) || 1).fill(''));
            }
          }}
          className="btn btn-outline"
          style={{ marginTop: '2rem', fontSize: '0.8rem' }}
        >
          Ändra svar (demo-läge)
        </button>
      </div>
    );
  }

  // ── Text poll ────────────────────────────────────────────
  if (activePoll.type === 'text') {
    const maxWords = Number(activePoll.max_words) || 1;
    return (
      <div className="animate-fade" style={{ maxWidth: '600px', margin: '5vh auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ color: 'var(--accent-magenta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Ordmoln
          </p>
          <h1 style={{ lineHeight: 1.2 }}>{activePoll.question}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Ange {maxWords === 1 ? 'ett ord' : `upp till ${maxWords} ord`}
          </p>
        </header>

        <form onSubmit={handleTextSubmit}>
          <div className="word-inputs">
            {wordInputs.map((val, i) => (
              <input
                key={i}
                value={val}
                onChange={e => {
                  const next = [...wordInputs];
                  next[i] = e.target.value;
                  setWordInputs(next);
                }}
                placeholder={maxWords === 1 ? 'Ditt ord...' : `Ord ${i + 1}...`}
                maxLength={40}
                autoFocus={i === 0}
                disabled={submitting}
                style={{ fontSize: '1.1rem', padding: '1rem 1.25rem' }}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem', gap: '0.6rem' }}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {submitting ? 'Skickar...' : 'Skicka'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.875rem' }}>
          Ditt svar är anonymt.
        </p>
      </div>
    );
  }

  // ── Multiple choice poll ─────────────────────────────────
  return (
    <div className="animate-fade" style={{ maxWidth: '600px', margin: '5vh auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <p style={{ color: 'var(--accent-blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Live Enkät
        </p>
        <h1 style={{ lineHeight: 1.2 }}>{activePoll.question}</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {activePoll.options.map((option, index) => (
          <button
            key={index}
            className="poll-option"
            onClick={() => handleVote(index)}
            disabled={submitting}
          >
            <div className="poll-content">
              <span style={{ fontSize: '1.25rem', fontWeight: 500 }}>{option}</span>
            </div>
          </button>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '3rem', fontSize: '0.875rem' }}>
        Ditt svar är anonymt.
      </p>
    </div>
  );
}
