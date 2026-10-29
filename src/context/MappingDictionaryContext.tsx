import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  mappingDictionaryManager,
  FieldAliasDefinition,
  MatchResult,
} from '../utils/mappingDictionary';

interface MappingDictionaryContextType {
  dictionary: FieldAliasDefinition[];
  setFullDictionary: (newDictionary: FieldAliasDefinition[]) => void;
  updateField: (
    key: string,
    updatedData: {
      newKey?: string;
      label?: string;
      description?: string;
      value_type?: 'text' | 'currency' | 'barcode' | 'number' | 'date' | 'promo';
      category?: 'identity' | 'pricing' | 'classification' | 'logistics' | 'lifecycle' | 'custom';
      default_aliases?: string[];
      custom_aliases?: string[];
      keywords?: string[];
      is_volatile?: boolean;
      numeric?: boolean;
    }
  ) => { success: boolean; message?: string };
  duplicateField: (sourceKey: string, newKey: string, newLabel?: string) => { success: boolean; message?: string };
  deleteField: (key: string) => boolean;
  addAlias: (key: string, alias: string) => { success: boolean; message?: string };
  removeAlias: (key: string, alias: string) => boolean;
  addCustomField: (field: {
    key: string;
    label: string;
    value_type: 'text' | 'currency' | 'barcode' | 'number' | 'date' | 'promo';
    category?: 'identity' | 'pricing' | 'classification' | 'logistics' | 'lifecycle' | 'custom';
    initial_aliases?: string[];
  }) => { success: boolean; message?: string };
  deleteCustomField: (key: string) => boolean;
  resetToDefaults: () => void;
  exportJson: () => string;
  importJson: (json: string) => { success: boolean; message?: string };
  detectField: (header: string, samples?: any[]) => MatchResult | null;
  isDictionaryModalOpen: boolean;
  openDictionaryModal: () => void;
  closeDictionaryModal: () => void;
}

const MappingDictionaryContext = createContext<MappingDictionaryContextType | null>(null);

export const MappingDictionaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dictionary, setDictionary] = useState<FieldAliasDefinition[]>(() =>
    mappingDictionaryManager.getDictionary()
  );
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = mappingDictionaryManager.subscribe(() => {
      setDictionary(mappingDictionaryManager.getDictionary());
    });
    return unsubscribe;
  }, []);

  const setFullDictionary = useCallback((newDict: FieldAliasDefinition[]) => {
    mappingDictionaryManager.setFullDictionary(newDict);
  }, []);

  const updateField = useCallback(
    (
      key: string,
      updatedData: {
        newKey?: string;
        label?: string;
        description?: string;
        value_type?: 'text' | 'currency' | 'barcode' | 'number' | 'date' | 'promo';
        category?: 'identity' | 'pricing' | 'classification' | 'logistics' | 'lifecycle' | 'custom';
        default_aliases?: string[];
        custom_aliases?: string[];
        keywords?: string[];
        is_volatile?: boolean;
        numeric?: boolean;
      }
    ) => {
      return mappingDictionaryManager.updateField(key, updatedData);
    },
    []
  );

  const duplicateField = useCallback((sourceKey: string, newKey: string, newLabel?: string) => {
    return mappingDictionaryManager.duplicateField(sourceKey, newKey, newLabel);
  }, []);

  const deleteField = useCallback((key: string) => {
    return mappingDictionaryManager.deleteField(key);
  }, []);

  const addAlias = useCallback((key: string, alias: string) => {
    return mappingDictionaryManager.addCustomAlias(key, alias);
  }, []);

  const removeAlias = useCallback((key: string, alias: string) => {
    return mappingDictionaryManager.removeCustomAlias(key, alias);
  }, []);

  const addCustomField = useCallback(
    (field: {
      key: string;
      label: string;
      value_type: 'text' | 'currency' | 'barcode' | 'number' | 'date' | 'promo';
      category?: 'identity' | 'pricing' | 'classification' | 'logistics' | 'lifecycle' | 'custom';
      initial_aliases?: string[];
    }) => {
      return mappingDictionaryManager.addCustomField(field);
    },
    []
  );

  const deleteCustomField = useCallback((key: string) => {
    return mappingDictionaryManager.deleteCustomField(key);
  }, []);

  const resetToDefaults = useCallback(() => {
    mappingDictionaryManager.resetToDefaults();
  }, []);

  const exportJson = useCallback(() => {
    return mappingDictionaryManager.exportDictionaryJson();
  }, []);

  const importJson = useCallback((json: string) => {
    return mappingDictionaryManager.importDictionaryJson(json);
  }, []);

  const detectField = useCallback((header: string, samples?: any[]) => {
    return mappingDictionaryManager.detectField(header, samples);
  }, []);

  const openDictionaryModal = useCallback(() => setIsDictionaryModalOpen(true), []);
  const closeDictionaryModal = useCallback(() => setIsDictionaryModalOpen(false), []);

  return (
    <MappingDictionaryContext.Provider
      value={{
        dictionary,
        setFullDictionary,
        updateField,
        duplicateField,
        deleteField,
        addAlias,
        removeAlias,
        addCustomField,
        deleteCustomField,
        resetToDefaults,
        exportJson,
        importJson,
        detectField,
        isDictionaryModalOpen,
        openDictionaryModal,
        closeDictionaryModal,
      }}
    >
      {children}
    </MappingDictionaryContext.Provider>
  );
};

export function useMappingDictionary(): MappingDictionaryContextType {
  const ctx = useContext(MappingDictionaryContext);
  if (!ctx) {
    // Return direct instance methods if used outside provider
    return {
      dictionary: mappingDictionaryManager.getDictionary(),
      setFullDictionary: (d) => mappingDictionaryManager.setFullDictionary(d),
      updateField: (k, u) => mappingDictionaryManager.updateField(k, u),
      duplicateField: (s, k, l) => mappingDictionaryManager.duplicateField(s, k, l),
      deleteField: (k) => mappingDictionaryManager.deleteField(k),
      addAlias: (k, a) => mappingDictionaryManager.addCustomAlias(k, a),
      removeAlias: (k, a) => mappingDictionaryManager.removeCustomAlias(k, a),
      addCustomField: (f) => mappingDictionaryManager.addCustomField(f),
      deleteCustomField: (k) => mappingDictionaryManager.deleteCustomField(k),
      resetToDefaults: () => mappingDictionaryManager.resetToDefaults(),
      exportJson: () => mappingDictionaryManager.exportDictionaryJson(),
      importJson: (j) => mappingDictionaryManager.importDictionaryJson(j),
      detectField: (h, s) => mappingDictionaryManager.detectField(h, s),
      isDictionaryModalOpen: false,
      openDictionaryModal: () => {},
      closeDictionaryModal: () => {},
    };
  }
  return ctx;
}
