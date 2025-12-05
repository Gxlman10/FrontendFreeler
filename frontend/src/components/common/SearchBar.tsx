import { FormEvent, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { t } from '@/i18n';

type SearchBarProps = {
  defaultValue?: string;
  placeholder?: string;
  isLoading?: boolean;
  onSearch: (term: string) => void;
  onClear?: () => void;
  className?: string;
  stackOnMobile?: boolean;
};

export const SearchBar = ({
  // Barra de busqueda reutilizable para listas filtrables
  defaultValue = '',
  placeholder = t('searchBar.defaultPlaceholder'),
  isLoading = false,
  onSearch,
  onClear,
  className,
  stackOnMobile = true,
}: SearchBarProps) => {
  const [term, setTerm] = useState(defaultValue);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(term.trim());
  };

  const handleClear = () => {
    setTerm('');
    onClear?.();
  };

  return (
    <form
      className={cn(
        'flex w-full gap-2',
        stackOnMobile ? 'flex-col sm:flex-row sm:items-center' : 'flex-row flex-wrap items-center',
        className,
      )}
      onSubmit={handleSubmit}
    >
      <Input
        placeholder={placeholder}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        className="flex-1"
      />
      <div className="flex gap-2">
        <Button type="submit" isLoading={isLoading}>
          {t('searchBar.submit')}
        </Button>
        {term && (
          <Button type="button" variant="ghost" onClick={handleClear}>
            {t('searchBar.clear')}
          </Button>
        )}
      </div>
    </form>
  );
};
