import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, StockSearchResult } from '../lib/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface StockSearchProps {
  onSelect: (stock: StockSearchResult) => void;
  placeholder?: string;
}

export default function StockSearch({ onSelect, placeholder = '搜索股票代码或名称' }: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.searchStocks(q, 8);
      setResults(data);
      setShowResults(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text.trim()), 400);
  };

  const handleSelect = (stock: StockSearchResult) => {
    setQuery(`${stock.symbol} ${stock.name}`);
    setShowResults(false);
    setResults([]);
    onSelect(stock);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={handleChange}
          autoCapitalize="characters"
        />
        {loading && <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {showResults && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.symbol}-${item.exchange}`}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                <View style={styles.resultLeft}>
                  <Text style={styles.resultSymbol}>{item.symbol}</Text>
                  <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={styles.resultExchange}>{item.exchange}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 100 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  searchIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    height: 46,
  },
  loader: { marginLeft: Spacing.sm },
  clearBtn: { marginLeft: Spacing.sm, padding: 2 },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 240,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultLeft: { flex: 1, gap: 2 },
  resultSymbol: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  resultName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  resultExchange: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: Spacing.sm },
});
