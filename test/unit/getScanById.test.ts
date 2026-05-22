import { describe, expect, it, jest } from '@jest/globals';
import { getScanById } from '../../wasp-app/src/scans/operations';

describe('getScanById', () => {
  it('accepts a non-uuid scan id and queries by id', async () => {
    const findFirst = jest.fn() as jest.MockedFunction<() => Promise<any>>;
    findFirst.mockResolvedValue({
      id: 'scan-result-free-001',
      status: 'done',
      inputType: 'github',
      inputRef: 'https://github.com/lodash/lodash',
      planAtSubmission: 'free',
      scanResults: [],
      scanDeltas: [],
    } as any);

    const result = await getScanById(
      { scanId: 'scan-result-free-001' },
      {
        user: { id: 'user-1', workspaceId: 'workspace-1' } as any,
        entities: {
          Scan: {
            findFirst,
          },
        },
      },
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'scan-result-free-001',
        OR: [
          { workspaceId: 'workspace-1' },
          { workspaceId: null, userId: 'user-1' },
        ],
      },
      include: {
        scanResults: true,
        scanDeltas: true,
      },
    });
    expect(result.id).toBe('scan-result-free-001');
  });

  it('still rejects an empty scan id', async () => {
    await expect(
      getScanById(
        { scanId: '   ' },
        {
          user: { id: 'user-1', workspaceId: 'workspace-1' } as any,
          entities: {
            Scan: {
              findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Operation arguments validation failed',
    });
  });
});
