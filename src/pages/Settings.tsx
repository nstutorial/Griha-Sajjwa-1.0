import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { useControl } from '@/contexts/ControlContext';

export interface TabSettings {
  loans: boolean;
  customers: boolean;
  daywise: boolean;
  payments: boolean;
}

export interface ControlSettings {
  allowEdit: boolean;
  allowDelete: boolean;
  allowAddNew: boolean;
  allowExport: boolean;
  showFinancialTotals: boolean;
  allowBulkOperations: boolean;
  allowAddPayment: boolean;
  allowPaymentManager: boolean;
  allowRecordPayment: boolean;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshSettings } = useControl();
  const [settings, setSettings] = useState<TabSettings>({
    loans: true,
    customers: true,
    daywise: true,
    payments: true,
  });
  const [controlSettings, setControlSettings] = useState<ControlSettings>({
    allowEdit: true,
    allowDelete: true,
    allowAddNew: true,
    allowExport: true,
    showFinancialTotals: true,
    allowBulkOperations: true,
    allowAddPayment: true,
    allowPaymentManager: true,
    allowRecordPayment: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('visible_tabs, control_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        
        // Check if it's a column not found error
        if (error.code === '42703') {
          toast({
            title: 'Migration Needed',
            description: 'Control settings column missing. Please run the database migration.',
            variant: 'destructive',
          });
          // Use defaults and don't return
        setControlSettings({
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
        });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load settings',
            variant: 'destructive',
          });
          return;
        }
      }

      if (data) {
        const settings = (data as any)?.visible_tabs as unknown as TabSettings;
        setSettings(settings);
        
        // Try to load control settings from database
        const defaultControlSettings = {
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
        };
        
        if ((data as any)?.control_settings) {
          // Merge database settings with defaults to ensure all fields are present
          const dbSettings = (data as any).control_settings;
          setControlSettings({
            ...defaultControlSettings,
            ...dbSettings
          });
        } else {
          // Use defaults if control_settings not found
          setControlSettings(defaultControlSettings);
        }
      } else {
        // If no settings exist, use defaults and create them
        const defaultSettings = {
          loans: true,
          customers: true,
          daywise: true,
          payments: true,
        };
        
        const defaultControls = {
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
        };
        
        setSettings(defaultSettings);
        setControlSettings(defaultControls);
        
        // Create default settings in database
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: defaultSettings,
          });
          
        if (insertError) {
          console.error('Error creating default settings:', insertError);
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof TabSettings) => {
    if (!user || isUpdating) return;

    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setIsUpdating(true);

    try {
      console.log('Updating settings for user:', user.id);
      console.log('New settings:', newSettings);
      
      // First, try to update existing record
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing settings:', fetchError);
        throw fetchError;
      }

      console.log('Existing data:', existingData);

      let error;
      if (existingData) {
        // Update Existing Record
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            visible_tabs: newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: newSettings,
          });
        error = insertError;
      }

      if (error) {
        console.error('Settings update error:', error);
        // Revert the local state on error
        setSettings(settings);
        toast({
          title: 'Error',
          description: `Failed to update settings: ${error.message}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Settings updated successfully',
        });
      }
    } catch (error) {
      console.error('Unexpected error updating settings:', error);
      // Revert the local state on error
      setSettings(settings);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating settings',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleControlToggle = async (key: keyof ControlSettings) => {
    if (!user || isUpdating) return;

    const newControlSettings = { ...controlSettings, [key]: !controlSettings[key] };
    setControlSettings(newControlSettings);
    setIsUpdating(true);

    try {
      console.log('Updating control settings for user:', user.id);
      console.log('New control settings:', newControlSettings);
      
      // First, try to update existing record
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing settings:', fetchError);
        throw fetchError;
      }

      if (existingData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            control_settings: newControlSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating control settings:', updateError);
          throw updateError;
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: settings as any,
            control_settings: newControlSettings,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error inserting control settings:', insertError);
          throw insertError;
        }
      }

      toast({
        title: 'Success',
        description: 'Control settings updated successfully',
      });

      // Refresh the global control context
      refreshSettings();

    } catch (error) {
      console.error('Unexpected error updating control settings:', error);
      // Revert the local state on error
      setControlSettings(controlSettings);
      
      // Check if it's a column not found error
      if (error && typeof error === 'object' && 'code' in error && error.code === '42703') {
        toast({
          title: 'Database Migration Required',
          description: 'The control_settings column needs to be added to your database. Please run the migration.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred while updating control settings',
          variant: 'destructive',
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const resetToDefaults = async () => {
    const defaultSettings = {
      loans: true,
      customers: true,
      daywise: true,
      payments: true,
    };

    const defaultControls = {
      allowEdit: true,
      allowDelete: true,
      allowAddNew: true,
      allowExport: true,
      showFinancialTotals: true,
      allowBulkOperations: true,
      allowAddPayment: true,
      allowPaymentManager: true,
      allowRecordPayment: true,
    };

    setSettings(defaultSettings);
    setControlSettings(defaultControls);
    
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          visible_tabs: defaultSettings,
          control_settings: defaultControls,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to reset settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Settings reset to defaults',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset settings',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your application preferences</p>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="max-w-2xl space-y-6">
          {/* Tab Visibility Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Tab Visibility Settings</CardTitle>
              <CardDescription>
                Control which tabs are visible in the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={key} className="capitalize text-base font-medium">
                        {key === 'daywise' ? 'Daywise Payment' : key}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {key === 'loans' && 'Manage loans and repayments'}
                        {key === 'customers' && 'Customer management and details'}
                        {key === 'daywise' && 'Daily payment schedule overview'}
                        {key === 'payments' && 'Payment history and tracking'}
                      </p>
                    </div>
                    <Switch
                      id={key}
                      checked={value}
                      disabled={isUpdating}
                      onCheckedChange={() => handleToggle(key as keyof TabSettings)}
                    />
                  </div>
                ))}
              </div>

              {/* Reset Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={resetToDefaults}
                  disabled={isUpdating}
                  className="w-full"
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Controller Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Controller Settings</CardTitle>
              <CardDescription>
                Control the visibility of edit, delete, and other operations throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
              <div className="grid gap-4">
                {Object.entries(controlSettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={key} className="capitalize text-base font-medium">
                        {key === 'allowEdit' && 'Edit Operations'}
                        {key === 'allowDelete' && 'Delete Operations'}
                        {key === 'allowAddNew' && 'Add New Items'}
                        {key === 'allowExport' && 'Export Functions'}
                        {key === 'showFinancialTotals' && 'Financial Totals Display'}
                        {key === 'allowBulkOperations' && 'Bulk Operations'}
                        {key === 'allowAddPayment' && 'Add Payment Operations'}
                        {key === 'allowPaymentManager' && 'Payment Manager Tab'}
                        {key === 'allowRecordPayment' && 'Record Payment Button'}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {key === 'allowEdit' && 'Show/hide edit buttons and modify forms throughout the app'}
                        {key === 'allowDelete' && 'Show/hide delete buttons and remove data functionality'}
                        {key === 'allowAddNew' && 'Show/hide add buttons and create new records'}
                        {key === 'allowExport' && 'Enable/disable CSV export, PDF generation, and data downloads'}
                        {key === 'showFinancialTotals' && 'Display/hide financial summaries and totals in reports'}
                        {key === 'allowBulkOperations' && 'Enable/disable multi-record operations and batch actions'}
                        {key === 'allowAddPayment' && 'Show/hide Add Payment buttons in loan lists and payment forms'}
                        {key === 'allowPaymentManager' && 'Show/hide Payment Manager tab in Customers section'}
                        {key === 'allowRecordPayment' && 'Show/hide Record Payment button in loan details and payment dialogs'}
                      </p>
                    </div>
                    <Switch
                      id={key}
                      checked={value}
                      disabled={isUpdating}
                      onCheckedChange={() => handleControlToggle(key as keyof ControlSettings)}
                    />
                  </div>
                ))}
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
