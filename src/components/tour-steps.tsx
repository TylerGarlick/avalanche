import type { TourStep } from '@/hooks/useFeatureTour';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'check-in',
    title: 'Check-In/Check-Out',
    body: 'Tap Check In before you head out. If you don\'t check out, we\'ll alert your emergency contacts after 6 hours. Your identity stays private.',
    target: '[data-tour="check-in"]',
    highlightType: 'spotlight',
  },
  {
    id: 'aspect-elevation',
    title: 'Aspect + Elevation Map',
    body: 'Tap any slope on the map to see its danger rating by aspect and elevation. Colors show danger level. Swipe to see details.',
    target: '.leaflet-container',
    highlightType: 'spotlight',
  },
  {
    id: 'epistemic-labels',
    title: 'Epistemic Labels',
    body: 'These labels show our confidence: [KNOWN] means observed, [INFERRED] means likely, [UNCERTAIN] means we\'re not sure. When in doubt, stay out.',
    target: '[data-tour="epistemic-labels"]',
    highlightType: 'tooltip',
  },
  {
    id: 'sort-distance',
    title: 'Sort by Distance',
    body: 'Your location is sorted to the top. Nearest stations, nearest danger zones, nearest help.',
    target: '[data-tour="sort-distance"]',
    highlightType: 'spotlight',
  },
  {
    id: 'above-treeline',
    title: 'Above Treeline Warning',
    body: 'Red zones mark terrain above treeline — where conditions change fast and help is far away.',
    target: '[data-tour="above-treeline"]',
    highlightType: 'spotlight',
  },
  {
    id: 'ready-to-go',
    title: 'Ready to Go',
    body: 'Check the forecast, check in, and come home safe. Tap any feature to learn more.',
    target: undefined,
    highlightType: 'none',
  },
];

export default TOUR_STEPS;
