import { css } from './deps_app.ts';

export class Material {
    static highEmphasisTextColor = 'rgba(255, 255, 255, 0.87)';
    static mediumEmphasisTextColor = 'rgba(255, 255, 255, 0.60)';
}

export const MATERIAL_CSS = css`

:root {
  --surface-01-background-color: rgb(30.75, 30.75, 30.75);
  --surface-04-background-color: rgb(40.95, 40.95, 40.95);
  --high-emphasis-text-color: rgba(255, 255, 255, 0.87);
  --medium-emphasis-text-color: rgba(255, 255, 255, 0.60);
  --disabled-text-color: rgba(255, 255, 255, 0.38);
  --button-border-radius: 0.25rem;
  --primary-color: #bb86fc;
  --background-color: #121212;
  --sans-serif-font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, Ubuntu, roboto, noto, segoe ui, arial, sans-serif;
}

/** text size classes */

.h6 {
    font-size: 1.25rem;
    letter-spacing: 0.00750rem;
    font-weight: bolder;
}

.body2, fieldset label, fieldset output, fieldset details {
    font-size: 0.875rem;
    letter-spacing: 0.01786rem;
    font-weight: normal;
    line-height: 1.25rem;
}

.button, button, .action-icon {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.08929rem;
    font-weight: bolder;
}

.overline {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.15000rem;
    font-weight: normal;
}

.caption {
    font-size: 0.75rem;
    letter-spacing: 0.03333rem;
    font-weight: normal;
}

/* light text on dark background colors */

.high-emphasis-text {
    color: var(--high-emphasis-text-color);
}

.medium-emphasis-text, fieldset label {
    color: var(--medium-emphasis-text-color);
}

.disabled-emphasis-text {
    color: var(--disabled-text-color);
}

/** elevation backgrounds */

.surface-01 {
    background-color: var(--surface-01-background-color);
}

.surface-04 {
    background-color: var(--surface-04-background-color);
}

/** action-icon */

.action-icon {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    min-width: 2rem;
    border-radius: var(--button-border-radius);
    color: var(--high-emphasis-text-color);
    opacity: 0.69;  /** medium-emphasis / high-emphasis */
    user-select: none;
}

.action-icon:hover {
    background-color: var(--surface-04-background-color);
    opacity: 1;
}

/** button */

button {
    border: none;
    background-color: var(--surface-01-background-color);
    color: var(--medium-emphasis-text-color);
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none;
    min-width: 8rem;
    border-radius: var(--button-border-radius);
}

button.selected {
    background-color: var(--surface-04-background-color);
    color: var(--high-emphasis-text-color);
}

button:hover {
    background-color: var(--surface-04-background-color);
    color: var(--high-emphasis-text-color);
}

button:disabled {
    color: var(--disabled-text-color);
}

button:disabled:hover {
    background-color: var(--surface-01-background-color);
    cursor: default;
}

/** anchors */

a {
    color: var(--primary-color);
    text-underline-offset: 0.25rem;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/** forms */

fieldset {
    border: solid 1px rgba(255, 255, 255, 0.60);
    border-radius: var(--button-border-radius);
    display: grid;
    grid-row-gap: 1rem;
    grid-column-gap: 1rem;
    padding: 1rem;
}

label {
    grid-column: 1;
    /* background-color: red; */
    padding: 0.5rem 0;
}

.form-lhs {
    grid-column: 1;
}

input, .form-rhs {
    grid-column: 2;
}

.form-row {
    grid-column: 1 / span 2;
}

fieldset input[type=text] {
    padding: 0.5rem;
    background-color: var(--surface-01-background-color);
    color: var(--high-emphasis-text-color);
    border: solid 1px var(--medium-emphasis-text-color);
    border-radius: var(--button-border-radius);
}

fieldset output {
    padding: 0.5rem 0;
    color: var(--medium-emphasis-text-color);
}

fieldset details {
    color: var(--medium-emphasis-text-color);
}

`;
