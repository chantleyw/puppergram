import { describe, it, expect } from 'vitest';
import { parseSpeech } from './parseSpeech';

const g = (s: string) => parseSpeech(s).grams;
const c = (s: string) => parseSpeech(s).collar;

describe('spoken weights', () => {
  it.each([
    ['blue two forty five', 245],
    ['blue two hundred and forty five', 245],
    ['blue two hundred forty five', 245],
    ['blue 245', 245],
    ['blue two four five', 245],
    ['blue three ninety', 390],
    ['blue four hundred', 400],
    ['blue four fifty', 450],
    ['blue two hundred five', 205],
    ['blue one ten', 110],
    ['blue five hundred and six', 506],
    ['blue one thousand two hundred', 1200],
    ['blue eleven hundred', 1100],
    ['blue nine ninety nine', 999],
    ['blue sixty five', 65],
  ])('parses %j as %i g', (phrase, expected) => {
    expect(g(phrase)).toBe(expected);
  });

  it('tolerates a trailing unit word', () => {
    expect(g('blue two forty five grams')).toBe(245);
    expect(g('blue 245g')).toBe(245);
    expect(g('blue 245 grams')).toBe(245);
  });

  it('tolerates filler and punctuation', () => {
    expect(g('Blue, two forty five.')).toBe(245);
    expect(g('blue is two forty five')).toBe(245);
    expect(g('okay blue two forty five')).toBe(245);
  });

  it('accepts the number before the colour', () => {
    const r = parseSpeech('245 blue');
    expect(r.grams).toBe(245);
    expect(r.collar).toBe('blue');
  });
});

describe('collar recognition', () => {
  it.each([
    ['blue two forty five', 'blue'],
    ['red three hundred', 'red'],
    ['gray four hundred', 'grey'],
    ['grey four hundred', 'grey'],
    ['violet four hundred', 'purple'],
    ['Yellow 300', 'yellow'],
  ])('hears the collar in %j', (phrase, expected) => {
    expect(c(phrase)).toBe(expected);
  });

  it.each([
    ['teal 300', 'teal'],
    ['turquoise 300', 'teal'],
    ['brown 300', 'brown'],
    ['lime 300', 'lime'],
    ['maroon 300', 'maroon'],
    ['navy 300', 'navy'],
    ['lavender 300', 'lavender'],
    ['lilac 300', 'lavender'],
    ['cream 300', 'cream'],
    ['silver 300', 'silver'],
  ])('hears the extended collar in %j', (phrase, expected) => {
    expect(c(phrase)).toBe(expected);
  });

  it('keeps navy and blue apart', () => {
    expect(c('navy four hundred')).toBe('navy');
    expect(c('blue four hundred')).toBe('blue');
  });

  it('ignores collars that are not in this litter', () => {
    expect(parseSpeech('purple 300', ['blue', 'red']).collar).toBeNull();
  });

  it('still recovers the weight when the collar is unusable', () => {
    const r = parseSpeech('purple 300', ['blue', 'red']);
    expect(r.grams).toBe(300);
    expect(r.confidence).toBe('low');
  });
});

describe('confidence and refusal', () => {
  it('is high only when both halves are present', () => {
    expect(parseSpeech('blue two forty five').confidence).toBe('high');
    expect(parseSpeech('blue').confidence).toBe('low');
    expect(parseSpeech('two forty five').confidence).toBe('low');
  });

  it('rejects implausible weights rather than recording them', () => {
    const r = parseSpeech('blue three');
    expect(r.grams).toBeNull();
    expect(r.problem).toMatch(/plausible range/);
  });

  it('rejects a nonsense transcript', () => {
    const r = parseSpeech('the dog is on the blanket');
    expect(r.grams).toBeNull();
    expect(r.confidence).toBe('low');
  });

  it('always reports the raw transcript for the correction chip', () => {
    expect(parseSpeech('  blue two forty five ').transcript).toBe(
      'blue two forty five'
    );
  });
});
