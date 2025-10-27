import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_invested: number;
}

interface PartnersListProps {
  partners: Partner[];
}

export function PartnersList({ partners }: PartnersListProps) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {partners.map((partner) => (
        <Card key={partner.id} className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/partners/${partner.id}`)}>
          <CardHeader>
            <CardTitle className="text-lg">{partner.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {partner.phone && (
                <p className="text-muted-foreground">Phone: {partner.phone}</p>
              )}
              {partner.email && (
                <p className="text-muted-foreground">Email: {partner.email}</p>
              )}
              <p className="text-lg font-semibold mt-2">
                Total Invested: ₹{partner.total_invested.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
