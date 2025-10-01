import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdate: (settings: TabSettings) => void;
}

export interface TabSettings {
  expenses: boolean;
  loans: boolean;
  customers: boolean;
  sales: boolean;
  daywise: boolean;
  payments: boolean;
}

const SettingsDialog = ({ open, onOpenChange, onSettingsUpdate }: SettingsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<TabSettings>({
    expenses: true,
    loans: true,
    customers: true,
    sales: true,
    daywise: true,
    payments: true,
  });

  useEffect(() => {
    if (open && user) {
      fetchSettings();
    }
  }, [open, user]);

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('visible_tabs')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      const settings = data.visible_tabs as unknown as TabSettings;
      setSettings(settings);
      onSettingsUpdate(settings);
    }
  };

  const handleToggle = async (key: keyof TabSettings) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        visible_tabs: newSettings,
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Settings updated',
      });
      onSettingsUpdate(newSettings);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tab Visibility Settings</DialogTitle>
          <DialogDescription>
            Control which tabs are visible in the dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="capitalize">
                {key}
              </Label>
              <Switch
                id={key}
                checked={value}
                onCheckedChange={() => handleToggle(key as keyof TabSettings)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
