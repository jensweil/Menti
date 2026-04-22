import React, { useState, useEffect } from 'react';
import { supabase, getPolls, getTextVotesForPoll } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Check, Play, BarChart2, Shield, Trash2, LogOut, Type, List, ExternalLink, CloudLightning } from 'lucide-react';

export default function AdminView({ onNavigate }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [polls, setPolls] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [pollType, setPollType] = useState('multiple_choice'); // 'multiple_choice' | 'text'
  const [maxWords, setMaxWords] = useState(1);
  const [votes, setVotes] = useState({});
  const [wordMap, setWordMap] = useState({});
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadPolls();
      subscribeToVotes();
    }
  }, [isAuthenticated]);

  const loadPolls = async () => {
    const { data } = await getPolls();
    setPolls(data || []);
    const active = data?.find(p => p.is_active);
    if (active) {
      setActivePoll(active);
      if (active.type === 'text') {
        loadWordMap(active.id);
      } else {
        loadVotes(active.id);
      }
    }
  };

  const loadVotes = async (pollId) => {
    const { data } = await supabase
      .from('votes')
      .select('option_index')
      .eq('poll_id', pollId);
    processVotes(data);
  };

  const loadWordMap = async (pollId) => {
    const { words } = await getTextVotesForPoll(pollId);
    setWordMap(words);
  };

  const processVotes = (votesList) => {
    const counts = {};
    votesList?.forEach(v => {
      if (v.option_index !== null && v.option_index !== undefined)
        counts[v.option_index] = (counts[v.option_index] || 0) + 1;
    });
    setVotes(counts);
  };

  const subscribeToVotes = () => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          if (payload.new.text_response) {
            // Text vote
            const cleaned = payload.new.text_response.trim().toLowerCase();
            setWordMap(prev => ({ ...prev, [cleaned]: (prev[cleaned] || 0) + 1 }));
          } else {
            // MC vote
            setVotes(prev => {
              const next = { ...prev };
              next[payload.new.option_index] = (next[payload.new.option_index] || 0) + 1;
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Fel lösenord!');
    }
  };

  const createPoll = async () => {
    setCreateError('');
    if (!newQuestion.trim()) {
      setCreateError('Frågan får inte vara tom.');
      return;
    }

    if (pollType === 'multiple_choice') {
      const options = newOptions.filter(o => o.trim() !== '');
      if (options.length < 2) {
        setCreateError('Du måste ha minst 2 svarsalternativ.');
        return;
      }
      const { error } = await supabase.from('polls').insert([{
        question: newQuestion,
        options,
        type: 'multiple_choice',
        max_words: null,
      }]);
      if (error) { setCreateError(`Fel: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from('polls').insert([{
        question: newQuestion,
        options: [],
        type: 'text',
        max_words: Number(maxWords) || 1,
      }]);
      if (error) { setCreateError(`Fel: ${error.message}`); return; }
    }

    setNewQuestion('');
    setNewOptions(['', '']);
    setPollType('multiple_choice');
    setMaxWords(1);
    loadPolls();
  };

  const toggleActive = async (poll) => {
    await supabase.from('polls').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (!poll.is_active) {
      await supabase.from('polls').update({ is_active: true }).eq('id', poll.id);
      setActivePoll(poll);
      setVotes({});
      setWordMap({});
      if (poll.type === 'text') {
        loadWordMap(poll.id);
      } else {
        loadVotes(poll.id);
      }
    } else {
      setActivePoll(null);
      setVotes({});
      setWordMap({});
    }
    loadPolls();
  };

  const deletePoll = async (id) => {
    if (!confirm('Är du säker på att du vill ta bort denna enkät?')) return;
    await supabase.from('polls').delete().eq('id', id);
    loadPolls();
  };

  const openResultsScreen = () => {
    window.open('/results', '_blank', 'noopener');
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-card animate-fade" style={{ maxWidth: '400px', margin: '100px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Shield size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem' }} />
          <h2>Admin Login</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Ange lösenord för att hantera enkäter</p>
        </div>
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <input
              type="password"
              placeholder="Lösenord..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Logga in
          </button>
        </form>
      </div>
    );
  }

  const votingUrl = window.location.origin;
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const totalTextVotes = Object.values(wordMap).reduce((a, b) => a + b, 0);
  const topWords = Object.entries(wordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="heading-xl" style={{ margin: 0 }}>Admin Dashboard</h1>
        <button onClick={() => setIsAuthenticated(false)} className="btn btn-outline" title="Logga ut">
          <LogOut size={20} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Create Poll */}
          <section className="glass-card">
            <h3><Plus size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Skapa ny enkät</h3>

            {/* Type toggle */}
            <div className="type-toggle" style={{ marginTop: '1.5rem' }}>
              <button
                className={pollType === 'multiple_choice' ? 'active' : ''}
                onClick={() => setPollType('multiple_choice')}
              >
                <List size={16} /> Flerval
              </button>
              <button
                className={pollType === 'text' ? 'active' : ''}
                onClick={() => setPollType('text')}
              >
                <CloudLightning size={16} /> Ordmoln
              </button>
            </div>

            <div className="input-group">
              <label>Fråga</label>
              <input
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="Vad tycker du om..."
              />
            </div>

            {pollType === 'multiple_choice' ? (
              <div className="input-group">
                <label>Alternativ</label>
                {newOptions.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={e => {
                      const next = [...newOptions];
                      next[i] = e.target.value;
                      setNewOptions(next);
                    }}
                    placeholder={`Alternativ ${i + 1}`}
                    style={{ marginBottom: '0.5rem' }}
                  />
                ))}
                <button
                  onClick={() => setNewOptions([...newOptions, ''])}
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  + Lägg till alternativ
                </button>
              </div>
            ) : (
              <div className="input-group">
                <label>Antal ord per deltagare</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxWords}
                  onChange={e => setMaxWords(e.target.value)}
                  style={{ maxWidth: '120px' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Varje deltagare anger upp till {maxWords} ord
                </span>
              </div>
            )}

            <button onClick={createPoll} className="btn btn-primary">Skapa enkät</button>
            {createError && (
              <p style={{ color: '#ef4444', marginTop: '0.75rem', fontSize: '0.9rem' }}>{createError}</p>
            )}
          </section>

          {/* Poll List */}
          <section className="glass-card">
            <h3>Hantera enkäter</h3>
            <div style={{ marginTop: '1rem' }}>
              {polls.map(poll => (
                <div key={poll.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderBottom: '1px solid var(--glass-border)'
                }}>
                  <div>
                    <strong style={{ display: 'block' }}>{poll.question}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {poll.type === 'text'
                        ? `Ordmoln · max ${poll.max_words} ord`
                        : `${poll.options?.length} alternativ`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => toggleActive(poll)}
                      className={`btn ${poll.is_active ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.5rem' }}
                      title={poll.is_active ? 'Avsluta' : 'Starta'}
                    >
                      {poll.is_active ? <Check size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => deletePoll(poll.id)}
                      className="btn btn-outline"
                      style={{ padding: '0.5rem', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ))}
              {polls.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Inga enkäter skapade ännu.</p>}
            </div>
          </section>
        </div>

        {/* Real-time Results & QR */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section className="glass-card">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <BarChart2 size={32} color="var(--accent-magenta)" />
              <h3>Realtidsresultat</h3>
              {activePoll ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Aktiv: {activePoll.question}</p>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ingen aktiv enkät</p>
              )}
            </div>

            {/* Multiple choice results */}
            {activePoll?.type !== 'text' && activePoll && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activePoll.options.map((opt, i) => {
                  const count = votes[i] || 0;
                  const percent = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                        <span>{opt}</span>
                        <span>{count} röster ({Math.round(percent)}%)</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: 'var(--accent-gradient)',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Totalt: {totalVotes} svar
                </div>
              </div>
            )}

            {/* Text / word cloud preview */}
            {activePoll?.type === 'text' && (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '80px', alignItems: 'center', justifyContent: 'center' }}>
                  {topWords.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Väntar på svar...</p>
                  )}
                  {topWords.map(([word, count]) => (
                    <span
                      key={word}
                      style={{
                        fontSize: `${0.75 + count * 0.2}rem`,
                        fontWeight: 700,
                        color: ['#3b82f6','#d946ef','#06b6d4','#f59e0b','#10b981'][word.length % 5],
                        transition: 'font-size 0.4s ease',
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {totalTextVotes} ord insamlade
                </div>
                <button
                  onClick={openResultsScreen}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', gap: '0.5rem' }}
                >
                  <ExternalLink size={18} /> Visa på storskärm
                </button>
              </div>
            )}
          </section>

          {activePoll && (
            <section className="glass-card" style={{ textAlign: 'center' }}>
              <h3>Dela enkät</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Skanna för att rösta live</p>
              <div className="qr-container">
                <QRCodeSVG value={votingUrl} size={150} />
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                <a href={votingUrl} target="_blank" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                  {votingUrl}
                </a>
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
