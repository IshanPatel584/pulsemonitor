import { useNavigate } from 'react-router-dom';
import { Copy, MoreHorizontal, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/cn';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/Dropdown';

export default function MonitorActionsMenu({ monitor, onRequestDelete }) {
  const { openEditMonitor, notify } = useApp();
  const navigate = useNavigate();

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(monitor.url);
      notify('Endpoint URL copied to clipboard.');
    } catch {
      notify('Could not access the clipboard.', 'error');
    }
  };

  return (
    <Dropdown
      width={200}
      trigger={({ open, ...props }) => (
        <button
          {...props}
          type="button"
          aria-label={`Actions for ${monitor.name}`}
          className={cn(
            'focus-ring flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg',
            open && 'bg-hover text-fg',
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
    >
      <DropdownItem icon={Pencil} onSelect={() => openEditMonitor(monitor)}>
        Edit monitor
      </DropdownItem>
      <DropdownItem icon={TriangleAlert} onSelect={() => navigate(`/incidents?monitor=${monitor.id}`)}>
        View incidents
      </DropdownItem>
      <DropdownItem icon={Copy} onSelect={copyUrl}>
        Copy endpoint URL
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem icon={Trash2} tone="danger" onSelect={() => onRequestDelete(monitor)}>
        Delete monitor
      </DropdownItem>
    </Dropdown>
  );
}
