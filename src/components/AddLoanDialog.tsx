import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
}

interface AddLoanDialogProps {
  onLoanAdded: () => void;
}

const AddLoanDialog: React.FC<AddLoanDialogProps> = ({ onLoanAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    customerId: '',
    principalAmount: '',
    description: '',
    interestRate: '',
    interestType: 'none' as 'simple' | 'compound' | 'none',
    loanDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  });

  useEffect(() => {
    if (user && open) {
      fetchCustomers();
    }
  }, [user, open]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          customer_id: formData.customerId,
          principal_amount: parseFloat(formData.principalAmount),
          description: formData.description,
          interest_rate: formData.interestType === 'none' ? 0 : parseFloat(formData.interestRate),
          interest_type: formData.interestType,
          loan_date: formData.loanDate,
          due_date: formData.dueDate || null,
        });

      if (error) throw error;

      toast({
        title: "Loan created",
        description: "The loan has been successfully created.",
      });

      setFormData({
        customerId: '',
        principalAmount: '',
        description: '',
        interestRate: '',
        interestType: 'none',
        loanDate: new Date().toISOString().split('T')[0],
        dueDate: '',
      });
      
      setOpen(false);
      onLoanAdded();
    } catch (error) {
      console.error('Error creating loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create loan. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="principal">Principal Amount (₹)</Label>
            <Input
              id="principal"
              type="number"
              step="0.01"
              placeholder="Enter loan amount"
              value={formData.principalAmount}
              onChange={(e) => setFormData({ ...formData, principalAmount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Loan Description</Label>
            <Input
              id="description"
              type="text"
              placeholder="Enter loan description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Type</Label>
            <Select 
              value={formData.interestType} 
              onValueChange={(value: 'simple' | 'compound' | 'none') => setFormData({ ...formData, interestType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Interest</SelectItem>
                <SelectItem value="simple">Simple Interest (Annual)</SelectItem>
                <SelectItem value="compound">Compound Interest (Monthly)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.interestType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="interest-rate">
                Interest Rate (% {formData.interestType === 'simple' ? 'per annum' : 'per month'})
              </Label>
              <Input
                id="interest-rate"
                type="number"
                step="0.01"
                placeholder="Enter interest rate"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loan-date">Loan Date</Label>
            <Input
              id="loan-date"
              type="date"
              value={formData.loanDate}
              onChange={(e) => setFormData({ ...formData, loanDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Loan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoanDialog;