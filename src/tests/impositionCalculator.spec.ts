import { describe, it, expect } from 'vitest';
import { ImpositionCalculator } from '../utils/impositionCalculator';
import { ImpositionConfig } from '../types';

describe('ImpositionCalculator Specification Tests', () => {
  it('étiquette plus grande que la page → cols === 0', () => {
    // Label width 300 mm, height 100 mm on A4 portrait (210 x 297 mm)
    const config: ImpositionConfig = {
      page_size: 'A4',
      orientation: 'portrait',
      gap_mm: 2,
      margin_left_mm: 5,
      margin_right_mm: 5,
      margin_top_mm: 5,
      margin_bottom_mm: 5,
      show_cut_marks: false,
    };

    const result = ImpositionCalculator.calculate(
      300,
      100,
      { top: 0, bottom: 0, left: 0, right: 0 },
      config
    );

    expect(result.cols).toBe(0);
    expect(result.fits_on_page).toBe(false);
    expect(result.total_per_page).toBe(0);
  });

  it('gap_x_mm prime sur gap_mm', () => {
    // Label 50mm on A4 portrait (210mm wide, 10mm margins -> available 190mm)
    // If gap_mm = 50, cols would be Math.floor((190 + 50) / (50 + 50)) = 2.
    // But if gap_x_mm = 0, cols becomes Math.floor((190 + 0) / (50 + 0)) = 3.
    const configWithGapX: ImpositionConfig = {
      page_size: 'A4',
      orientation: 'portrait',
      gap_mm: 50, // Large gap that would restrict columns to 2
      gap_x_mm: 0, // Should override gap_mm
      margin_left_mm: 10,
      margin_right_mm: 10,
      margin_top_mm: 10,
      margin_bottom_mm: 10,
      show_cut_marks: false,
    };

    const res = ImpositionCalculator.calculate(
      50,
      30,
      { top: 0, bottom: 0, left: 0, right: 0 },
      configWithGapX
    );

    expect(res.cols).toBe(3);
  });

  it('applique les espaces, la calibration et le décalage de slot une seule fois', () => {
    const config: ImpositionConfig = {
      page_size: 'A4',
      orientation: 'portrait',
      gap_mm: 2,
      gap_x_mm: 5,
      gap_y_mm: 7,
      margin_left_mm: 10,
      margin_right_mm: 10,
      margin_top_mm: 10,
      margin_bottom_mm: 10,
      calibration_x_mm: 1.25,
      calibration_y_mm: -0.5,
      slot_nudges: { 1: { nudge_x_mm: 0.2, nudge_y_mm: 0.3 } },
      show_cut_marks: false,
    };
    const result = ImpositionCalculator.calculate(50, 30, { top: 0, bottom: 0, left: 0, right: 0 }, config);
    const position = ImpositionCalculator.getSlotPosition(result, config, 1);

    expect(result.horizontal_offset_mm).toBe(25);
    expect(result.vertical_offset_mm).toBe(22.5);
    expect(position).toEqual({ x_mm: 81.45, y_mm: 22.3 });
  });
});
