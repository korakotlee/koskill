import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StorageStatusBadge } from '../../../src/client/src/components/StorageStatusBadge.js';
import { FlashNotification } from '../../../src/client/src/components/FlashNotification.js';
import { CentralizeConfirmModal } from '../../../src/client/src/components/CentralizeConfirmModal.js';

describe('Storage UI Components', () => {
  describe('StorageStatusBadge', () => {
    it('renders Original badge with Label--accent', () => {
      const { container } = render(<StorageStatusBadge status="original" />);
      expect(screen.getByText('Original')).toBeDefined();
      expect(container.querySelector('.Label--accent')).toBeDefined();
    });

    it('renders Centralized badge with Label--success', () => {
      const { container } = render(<StorageStatusBadge status="centralized" />);
      expect(screen.getByText('Centralized')).toBeDefined();
      expect(container.querySelector('.Label--success')).toBeDefined();
    });

    it('renders Symlinked badge with Label--done', () => {
      const { container } = render(<StorageStatusBadge status="symlinked" />);
      expect(screen.getByText('Symlinked')).toBeDefined();
      expect(container.querySelector('.Label--done')).toBeDefined();
    });

    it('renders Broken Link badge with Label--danger', () => {
      const { container } = render(<StorageStatusBadge status="broken-link" />);
      expect(screen.getByText('Broken Link')).toBeDefined();
      expect(container.querySelector('.Label--danger')).toBeDefined();
    });
  });

  describe('FlashNotification', () => {
    it('renders success toast with flash-success styling', () => {
      const { container } = render(
        <FlashNotification message="Centralized 2 skills successfully" type="success" onDismiss={vi.fn()} />
      );
      expect(screen.getByText('Centralized 2 skills successfully')).toBeDefined();
      expect(container.querySelector('.flash-success')).toBeDefined();
    });

    it('renders danger toast and triggers onDismiss on close', () => {
      const onDismiss = vi.fn();
      render(
        <FlashNotification message="Failed to create symlink" type="danger" onDismiss={onDismiss} />
      );
      expect(screen.getByText('Failed to create symlink')).toBeDefined();
      const closeBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('CentralizeConfirmModal', () => {
    const mockItems = [
      {
        skillId: 'gemini:web-search',
        skillName: 'web-search',
        sourcePath: '/path/to/gemini/skills/web-search',
        targetCentralPath: '/Users/test/.koskill/skills/web-search',
      },
    ];

    it('renders modal overlay with manifest paths and calls onConfirm', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <CentralizeConfirmModal
          isOpen={true}
          action="centralize"
          items={mockItems}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText(/Confirm Centralization/i)).toBeDefined();
      expect(screen.getByText(/\/path\/to\/gemini\/skills\/web-search/)).toBeDefined();
      expect(screen.getByText(/\/Users\/test\/\.koskill\/skills\/web-search/)).toBeDefined();

      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalled();
    });

    it('calls onCancel when clicking cancel button', () => {
      const onCancel = vi.fn();
      render(
        <CentralizeConfirmModal
          isOpen={true}
          action="revert"
          items={mockItems}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalled();
    });

    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <CentralizeConfirmModal
          isOpen={false}
          action="centralize"
          items={mockItems}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
