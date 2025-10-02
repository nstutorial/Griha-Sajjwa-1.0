import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface ControlSettings {
  allowEdit: boolean;
  allowDelete: boolean;
  allowAddNew: boolean;
  allowExport: boolean;
  showFinancialTotals: boolean;
  allowBulkOperations: boolean;
}

interface ControlContextType {
  settings: ControlSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const ControlContext = createContext<ControlContextType | undefined>(undefined);

export const ControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ControlSettings>({
    allowEdit: true,
    allowDelete: true,
    allowAddNew: true,
    allowExport: true,
    showFinancialTotals: true,
    allowBulkOperations: true,
  });
  const [loading, setLoading] = useState(false);

  const fetchControlSettings = async () => {
    if (!user) {
      setSettings({
        allowEdit: true,
        allowDelete: true,
        allowAddNew: true,
        allowExport: true,
        showFinancialTotals: true,
        allowBulkOperations: true,
      });
      return;
    }

    setLoading(true);
    try {
      // Temporarily skip database fetch until migration is applied
      // Use defaults for now - settings will be available after user adds the column
      console.log('Using default control settings (migration needed for database persistence)');
      
      setSettings({
        allowEdit: true,
        allowDelete: true,
        allowAddNew: true,
        allowExport: true,
        showFinancialTotals: true,
        allowBulkOperations: true,
      });
      
    } catch (error) {
      console.error('Unexpected error fetching control settings:', error);
      setSettings({
        allowEdit: true,
        allowDelete: true,
        allowAddNew: true,
        allowExport: true,
        showFinancialTotals: true,
        allowBulkOperations: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await fetchControlSettings();
  };

  useEffect(() => {
    fetchControlSettings();
  }, [user]);

  return (
    <ControlContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </ControlContext.Provider>
  );
};

export const useControl = (): ControlContextType => {
  const context = useContext(ControlContext);
  if (context === undefined) {
    throw new Error('useControl must be used within a ControlProvider');
  }
  return context;
};
