import { createGdevelopTheme } from '../CreateTheme';

import styles from './DSGAMESThemeVariables.json';
import './DSGAMESThemeVariables.css';

export default createGdevelopTheme({
  styles,

  rootClassNameIdentifier: 'DSGAMESTheme',
  paletteType: 'dark',
  gdevelopIconsCSSFilter: 'hue-rotate(190deg) saturate(160%) brightness(105%)',
});
