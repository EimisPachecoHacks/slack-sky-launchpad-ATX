import React, { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Architecture } from '../../../types';
import CodeGenerator from '../CodeGenerator';
import { api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  api: {
    generateCode: vi.fn(),
  },
}));

const architecture = {
  id: 'alibaba-test',
  name: 'Alibaba Test',
  description: 'Minimal Alibaba architecture',
  provider: 'alicloud',
  components: [],
  alternatives: [],
  diagram: { nodes: [], edges: [] },
  metadata: {},
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
} as Architecture;

describe('CodeGenerator', () => {
  beforeEach(() => {
    vi.mocked(api.generateCode).mockReset();
    vi.mocked(api.generateCode).mockResolvedValue({
      success: true,
      message: 'generated',
      data: { code: 'provider "alicloud" {}' },
    } as never);
  });

  it('sends only one Qwen request when React StrictMode replays effects', async () => {
    render(
      <StrictMode>
        <CodeGenerator architecture={architecture} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(api.generateCode).toHaveBeenCalledTimes(1);
    });
    expect(api.generateCode).toHaveBeenCalledWith(architecture, 'terraform');
  });
});
