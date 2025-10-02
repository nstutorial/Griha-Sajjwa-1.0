import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { useControl } from '@/contexts/ControlContext';
import { Trash2 } from 'lucide-react';

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  payment_method: 'cash' | 'bank';
  category: {
    id: string;
    name: string;
  } | null;
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onExpenseUpdated: () => void;
}

const EditExpenseDialog: React.FC<EditExpenseDialogProps> = ({
  open,
  onOpenChange,
  expense,
  onExpenseUpdated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: '',
    payment_method: 'cash' as 'cash' | 'bank',
    category_id: 'none',
  });

  useEffect(() => {
    if (open && user) {
      fetchCategories();
      if (expense) {
        setFormData({
          amount: expense.amount.toString(),
          description: expense.description,
          date: expense.date.split('T')[0], // Format date for input
          payment_method: expense.payment_method,
          category_id: expense.category?.id || 'none',
        });
      }
    }
  }, [open, user, expense]);

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('type', 'expense')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expense || !formData.amount || !formData.description) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount),
          description: formData.description.trim(),
          date: formData.date
            ? new Date(formData.date).toISOString()
            : new Date().toISOString(),
          payment_method: formData.payment_method,
          category_id: formData.category_id === 'none' ? null : formData.category_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expense.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Expense updated",
        description: "Your expense has been successfully updated.",
      });

      onOpenChange(false);
      onExpenseUpdated();
    } catch (error) {
      console.error('Error updating expense:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update expense. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !expense) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${expense.description}"? This action cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Expense deleted",
        description: "The expense has been successfully deleted.",
      });

      onOpenChange(false);
      onExpenseUpdated();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the expense details including amount, description, date, and payment method.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter expense description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select
              value={formData.payment_method}

              onValueChange={(value: 'cash' | 'bank') =>
                setFormData({ ...formData, payment_method: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between">
            <div>
              {controlSettings.allowDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              {controlSettings.allowEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Expense'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditExpenseDialog;
