import {
  DEFAULT_LINEAGE_FULLSCREEN_REFIT_DELAY_MS,
  canUseLineageFullscreen,
  isLineageFullscreenActive,
  scheduleLineageFullscreenRefit,
} from '../src/components/useLineageFullscreen';

describe('lineage fullscreen contract', () => {
  it('detects support only when document and container expose the fullscreen API', () => {
    const container = {
      requestFullscreen: async () => undefined,
    } as HTMLElement;

    expect(canUseLineageFullscreen(null, container)).toBe(false);
    expect(
      canUseLineageFullscreen(
        {
          fullscreenEnabled: false,
          exitFullscreen: async () => undefined,
        } as Document,
        container,
      ),
    ).toBe(false);
    expect(
      canUseLineageFullscreen(
        {
          fullscreenEnabled: true,
          exitFullscreen: async () => undefined,
        } as Document,
        container,
      ),
    ).toBe(true);
  });

  it('derives the fullscreen state from document.fullscreenElement', () => {
    const container = {} as HTMLElement;

    expect(
      isLineageFullscreenActive(
        {
          fullscreenElement: container,
        } as unknown as Document,
        container,
      ),
    ).toBe(true);
    expect(
      isLineageFullscreenActive(
        {
          fullscreenElement: null,
        } as unknown as Document,
        container,
      ),
    ).toBe(false);
  });

  describe('scheduleLineageFullscreenRefit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('invokes the refit callback after the configured delay', () => {
      const onFullscreenChange = jest.fn();

      scheduleLineageFullscreenRefit(onFullscreenChange, true, 25);

      expect(onFullscreenChange).not.toHaveBeenCalled();
      jest.advanceTimersByTime(24);
      expect(onFullscreenChange).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(onFullscreenChange).toHaveBeenCalledWith(true);
    });

    it('returns a cleanup that cancels the pending refit callback', () => {
      const onFullscreenChange = jest.fn();

      const clearPending = scheduleLineageFullscreenRefit(
        onFullscreenChange,
        false,
        DEFAULT_LINEAGE_FULLSCREEN_REFIT_DELAY_MS,
      );

      clearPending();
      jest.runAllTimers();

      expect(onFullscreenChange).not.toHaveBeenCalled();
    });
  });
});