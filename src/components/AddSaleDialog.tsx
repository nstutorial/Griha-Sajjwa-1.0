import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface AddSaleDialogProps {
  onSaleAdded?: () => void;
}

const AddSaleDialog = ({ onSaleAdded }: AddSaleDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    sale_amount: '',
    sale_description: '',
    sale_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (open && user) {
      fetchCustomers();
    }
  }, [open, user]);

  const fetchCustomers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('user_id', user.id)
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load customers',
          variant: 'destructive',
        });
        return;
      }

      console.log('Fetched customers:', data);
      setCustomers(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: 'No Customers',
          description: 'Please add customers first before creating sales',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching customers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customers',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.customer_id || !formData.sale_amount || !formData.sale_description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Submitting sale:', formData);
      
      const { data, error } = await supabase.from('sales').insert({
        user_id: user.id,
        customer_id: formData.customer_id,
        sale_amount: parseFloat(formData.sale_amount),
        sale_description: formData.sale_description,
        sale_date: formData.sale_date,
      }).select();

      if (error) {
        console.error('Sale insert error:', error);
        toast({
          title: 'Error',
          description: `Failed to add sale: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      console.log('Sale added successfully:', data);
      toast({
        title: 'Success',
        description: 'Sale added successfully',
      });

      setFormData({
        customer_id: '',
        sale_amount: '',
        sale_description: '',
        sale_date: new Date().toISOString().split('T')[0],
      });

      setOpen(false);
      onSaleAdded?.();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Sale</DialogTitle>
          <DialogDescription>Record a new sale transaction</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, customer_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale_amount">Sale Amount *</Label>
              <Input
                id="sale_amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={formData.sale_amount}
                onChange={(e) =>
                  setFormData({ ...formData, sale_amount: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale_description">Description *</Label>
              <Textarea
                id="sale_description"
                placeholder="Describe the sale"
                value={formData.sale_description}
                onChange={(e) =>
                  setFormData({ ...formData, sale_description: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale_date">Sale Date *</Label>
              <Input
                id="sale_date"
                type="date"
                value={formData.sale_date}
                onChange={(e) =>
                  setFormData({ ...formData, sale_date: e.target.value })
                }
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              disabled={customers.length === 0}
            >
              {customers.length === 0 ? 'No Customers Available' : 'Add Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSaleDialog;
