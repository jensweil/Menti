import React, { useState, useEffect, useRef } from 'react';
import { supabase, getActivePoll, getTextVotesForPoll } from '../lib/supabase';

// Color palette for words
const COLORS = [
  '#3b82f6', '#d946ef', '#06b6d4', '#f59e0b',
  '#10b981', '#f43f5e', '#8b5cf6', '#34d399',
  '#fb923c', '#38bdf8', '#a78bfa', '#4ade80',
];

function getColor(word) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) hash = word.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getRotation(word) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) hash = word.charCodeAt(i) + ((hash << 3) - hash);
  // -15 to +15 degrees
  return ((Math.abs(hash) % 31) - 15);
}

export default function WordCloudScreen() {
  const [poll, setPoll]   = useState(null);
  const [words, setWords] = useState({});
  const [mcVotes, setMcVotes] = useState({});
  const [growing, setGrowing] = useState(new Set());
  const prevWords = useRef({});

  useEffect(() => {
    loadInitial();

    const channel = supabase
      .channel('results-votes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          if (payload.new.text_response) {
            // Word Cloud Vote
            const cleaned = payload.new.text_response.trim().toLowerCase();
            if (!cleaned) return;
            setWords(prev => {
              const next = { ...prev, [cleaned]: (prev[cleaned] || 0) + 1 };
              setGrowing(g => { const s = new Set(g); s.add(cleaned); return s; });
              setTimeout(() => setGrowing(g => { const s = new Set(g); s.delete(cleaned); return s; }), 500);
              return next;
            });
          } else {
            // Multiple Choice Vote
            const index = payload.new.option_index;
            setMcVotes(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => loadInitial()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const loadInitial = async () => {
    const { data } = await getActivePoll();
    setPoll(data);
    if (!data) return;

    if (data.type === 'text') {
      const { words: w } = await getTextVotesForPoll(data.id);
      setWords(w);
      setMcVotes({});
    } else {
      const { data: vData } = await supabase
        .from('votes')
        .select('option_index')
        .eq('poll_id', data.id);
      
      const counts = {};
      vData?.forEach(v => {
        counts[v.option_index] = (counts[v.option_index] || 0) + 1;
      });
      setMcVotes(counts);
      setWords({});
    }
  };

  const getSize = (count) => {
    const maxCount = Math.max(...Object.values(words), 1);
    const scale = count / maxCount;
    return 1.5 + scale * 8.5;
  };

  const wordEntries = Object.entries(words).sort((a, b) => b[1] - a[1]);
  const totalVotes = poll?.type === 'text' 
    ? Object.values(words).reduce((a, b) => a + b, 0)
    : Object.values(mcVotes).reduce((a, b) => a + b, 0);

  return (
    <div className="word-cloud-screen">
      <div style={{ position: 'absolute', top: '2rem', left: 0, right: 0, textAlign: 'center', padding: '0 2rem' }}>
        <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>
          Realtidsresultat
        </p>
        {poll ? (
          <h1 className="word-cloud-title">{poll.question}</h1>
        ) : (
          <h1 className="word-cloud-title">Väntar på aktiv enkät...</h1>
        )}
      </div>

      <div className="word-cloud-container" style={{ marginTop: '4rem' }}>
        {poll?.type === 'text' ? (
          wordEntries.length === 0 ? (
            <p className="word-cloud-empty">Väntar på svar...</p>
          ) : (
            wordEntries.map(([word, count]) => {
              const rot = getRotation(word);
              return (
                <span
                  key={word}
                  className={`word-cloud-word${growing.has(word) ? ' growing' : ''}`}
                  style={{
                    fontSize: `${getSize(count)}rem`,
                    color: getColor(word),
                    '--rot': `${rot}deg`,
                    transform: `rotate(${rot}deg)`,
                  }}
                >
                  {word}
                </span>
              );
            })
          )
        ) : poll?.type === 'multiple_choice' ? (
          <div className="results-chart-container animate-fade">
            {poll.options.map((opt, i) => {
              const count = mcVotes[i] || 0;
              const maxVal = Math.max(...Object.values(mcVotes), 1);
              const percent = (count / maxVal) * 100;
              return (
                <div key={i} className="chart-bar-wrapper">
                  <div className="chart-bar-value">{count}</div>
                  <div className="chart-bar-outer">
                    <div 
                      className="chart-bar-inner" 
                      style={{ '--percent': `${percent}%` } }
                    />
                  </div>
                  <div className="chart-bar-label">{opt}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="word-cloud-empty">Ingen aktiv enkät just nu</p>
        )}
      </div>

      {totalVotes > 0 && (
        <div style={{
          position: 'absolute', bottom: '2rem', left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem'
        }}>
          {totalVotes} svar totalt
        </div>
      )}
    </div>
  );
}
