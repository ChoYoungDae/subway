import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@subway_access_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const json = await AsyncStorage.getItem(FAVORITES_KEY);
      if (json) setFavorites(JSON.parse(json));
    } catch (e) {
      console.error('Failed to load favorites', e);
    } finally {
      setLoaded(true);
    }
  };

  const saveFavorites = async (newFavorites) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  };

  const toggleFavorite = useCallback((station) => {
    setFavorites((prev) => {
      const exists = prev.some((s) => s.id === station.id);
      const updated = exists
        ? prev.filter((s) => s.id !== station.id)
        : [...prev, { id: station.id, name_en: station.name_en, name_ko: station.name_ko, line: station.line }];
      saveFavorites(updated);
      return updated;
    });
  }, []);

  const isFavorite = useCallback(
    (stationId) => favorites.some((s) => s.id === stationId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite, loaded, reload: loadFavorites };
}
