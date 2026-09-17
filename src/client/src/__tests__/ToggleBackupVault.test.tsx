import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityToggleSwitch } from '../components/EntityToggleSwitch.js';
import { BackupModal } from '../components/BackupModal.js';
import { VaultDrawer } from '../components/VaultDrawer.js';

describe('EntityToggleSwitch Component', () => {
  it('renders active toggle switch when enabled is true', () => {
    render(
      <EntityToggleSwitch
        entityType="skills"
        id="test-skill"
        enabled={true}
        onToggle={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /Active/i });
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders inactive toggle switch when enabled is false', () => {
    render(
      <EntityToggleSwitch
        entityType="skills"
        id="test-skill"
        enabled={false}
        onToggle={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /Inactive/i });
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onToggle with desired target state on click', () => {
    const onToggle = vi.fn();
    render(
      <EntityToggleSwitch
        entityType="workflows"
        id="commit"
        enabled={true}
        onToggle={onToggle}
      />
    );

    const button = screen.getByRole('button', { name: /Active/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('disables switch and shows loading indicator when isLoading is true', () => {
    const onToggle = vi.fn();
    render(
      <EntityToggleSwitch
        entityType="mcp-servers"
        id="test-mcp"
        enabled={true}
        isLoading={true}
        onToggle={onToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button.getAttribute('disabled')).toBeDefined();
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('BackupModal Component', () => {
  it('renders export and import sections when open', () => {
    render(
      <BackupModal
        isOpen={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />
    );

    expect(screen.getByText('Backup & Restore')).toBeDefined();
    expect(screen.getByRole('button', { name: /Export Backup/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Import Archive/i })).toBeDefined();
  });

  it('calls onExport when clicking Export Backup button', () => {
    const onExport = vi.fn();
    render(
      <BackupModal
        isOpen={true}
        onClose={vi.fn()}
        onExport={onExport}
        onImport={vi.fn()}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export Backup/i });
    fireEvent.click(exportBtn);
    expect(onExport).toHaveBeenCalled();
  });

  it('calls onImport when archive path is entered', () => {
    const onImport = vi.fn();
    render(
      <BackupModal
        isOpen={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        onImport={onImport}
      />
    );

    const input = screen.getByPlaceholderText(/archive path/i);
    fireEvent.change(input, { target: { value: '/tmp/my-backup.tar.gz' } });

    const importBtn = screen.getByRole('button', { name: /Import Archive/i });
    fireEvent.click(importBtn);

    expect(onImport).toHaveBeenCalledWith('/tmp/my-backup.tar.gz', false);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BackupModal
        isOpen={true}
        onClose={onClose}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />
    );

    const closeBtns = screen.getAllByRole('button', { name: /Close|Cancel/i });
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('VaultDrawer Component', () => {
  const mockSecrets = [
    { key: 'OPENAI_API_KEY', maskedValue: 'sk-...48a9' },
    { key: 'GITHUB_TOKEN', maskedValue: 'ghp...7712' },
  ];

  it('renders stored secrets with masked preview values', () => {
    render(
      <VaultDrawer
        isOpen={true}
        secrets={mockSecrets}
        onClose={vi.fn()}
        onSaveSecret={vi.fn()}
      />
    );

    expect(screen.getByText('OPENAI_API_KEY')).toBeDefined();
    expect(screen.getByText('sk-...48a9')).toBeDefined();
    expect(screen.getByText('GITHUB_TOKEN')).toBeDefined();
    expect(screen.getByText('ghp...7712')).toBeDefined();
  });

  it('submits new credential via onSaveSecret', () => {
    const onSaveSecret = vi.fn();
    render(
      <VaultDrawer
        isOpen={true}
        secrets={mockSecrets}
        onClose={vi.fn()}
        onSaveSecret={onSaveSecret}
      />
    );

    const keyInput = screen.getByPlaceholderText(/KEY_NAME/i);
    const valueInput = screen.getByPlaceholderText(/Secret value/i);

    fireEvent.change(keyInput, { target: { value: 'NEW_API_KEY' } });
    fireEvent.change(valueInput, { target: { value: 'super-secret-1234' } });

    const saveBtn = screen.getByRole('button', { name: /Save Secret/i });
    fireEvent.click(saveBtn);

    expect(onSaveSecret).toHaveBeenCalledWith('NEW_API_KEY', 'super-secret-1234');
  });

  it('calls onClose when close drawer button is clicked', () => {
    const onClose = vi.fn();
    render(
      <VaultDrawer
        isOpen={true}
        secrets={mockSecrets}
        onClose={onClose}
        onSaveSecret={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close Vault/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
