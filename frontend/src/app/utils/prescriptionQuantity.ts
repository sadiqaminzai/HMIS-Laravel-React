/**
 * How many units a course of treatment comes to.
 *
 * Doses per day multiplied by days, from the two things a prescriber has
 * already typed. Extracted from PrescriptionCreate so Treatment Sets can use
 * the identical rule: the two screens produce the same kind of line, and a set
 * that computed quantities differently from a prescription would dispense
 * different amounts for the same instructions.
 *
 * Returns 0 when either half is unreadable, which leaves the field for the
 * user rather than guessing a number nobody chose.
 */
export const calculatePrescriptionQuantity = (dose: string, duration: string): number => {
  const doseText = String(dose ?? '');
  const durationText = String(duration ?? '');

  let dosePerDay = 0;

  // The standard morning-noon-night notation: 1-0-1, 1-1-1-1.
  if (doseText.includes('-')) {
    dosePerDay = doseText.split('-').reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (Number.isNaN(num) ? 0 : num);
    }, 0);
  } else {
    const lowerDose = doseText.toLowerCase();
    if (lowerDose.includes('once') || lowerDose === 'od' || lowerDose === 'stat') dosePerDay = 1;
    else if (lowerDose.includes('twice') || lowerDose === 'bid') dosePerDay = 2;
    else if (lowerDose.includes('thrice') || lowerDose === 'tid') dosePerDay = 3;
    else if (lowerDose.includes('four') || lowerDose === 'qid') dosePerDay = 4;
  }

  let days = 0;
  const lowerDuration = durationText.toLowerCase();
  const num = parseInt(durationText, 10) || 1;

  if (lowerDuration.includes('month')) {
    days = num * 30;
  } else if (lowerDuration.includes('week')) {
    days = num * 7;
  } else if (lowerDuration.includes('year')) {
    days = num * 365;
  } else if (lowerDuration.includes('day')) {
    days = parseInt(durationText, 10) || 0;
  } else if (lowerDuration.includes('continue')) {
    days = 15; // A working assumption when the course has no stated end.
  } else {
    days = parseInt(durationText, 10) || 0;
  }

  if (dosePerDay === 0 || days === 0) return 0;

  return Math.ceil(dosePerDay * days);
};
