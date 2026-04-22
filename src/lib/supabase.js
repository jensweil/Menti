import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getPolls = async () => {
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const getActivePoll = async () => {
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('is_active', true)
    .single();
  return { data, error };
};

export const vote = async (pollId, optionIndex) => {
  const { data, error } = await supabase
    .from('votes')
    .insert([{ poll_id: pollId, option_index: optionIndex }]);
  return { data, error };
};

export const getVotesForPoll = async (pollId) => {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('poll_id', pollId);
  return { data, error };
};

export const getTextVotesForPoll = async (pollId) => {
  const { data, error } = await supabase
    .from('votes')
    .select('text_response')
    .eq('poll_id', pollId)
    .not('text_response', 'is', null);

  if (error) return { words: {}, error };

  const words = {};
  data?.forEach(row => {
    const cleaned = row.text_response?.trim().toLowerCase();
    if (cleaned) {
      words[cleaned] = (words[cleaned] || 0) + 1;
    }
  });
  return { words, error: null };
};
