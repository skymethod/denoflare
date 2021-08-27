/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html, LitElement } from '../deps_app.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const FILTER_EDITOR_HTML = html`
<form id="filter-form" autocomplete="off">
<fieldset id="filter-fieldset">
  <div id="filter-form-title" class="h6 high-emphasis-text">Edit filter</div>

  <label id="filter-field-label">Filter field:</label>
  <input id="filter-field-text" type="text">
  <div id="filter-field-choice"></div>

  <div id="filter-form-help" class="body2 medium-emphasis-text">
  </div>  

  <div id="filter-form-output-row" class="form-row">
    <output id="filter-form-output"></output>
  </div>

  <div id="filter-form-buttons" class="form-rhs">
    <button id="filter-cancel">Cancel</button>
    <button id="filter-apply">Apply</button>
  </div>
</fieldset>
</form>
`;

export const FILTER_EDITOR_CSS = css`

    #filter-form-title {
        grid-column: 1 / span 2;
    }

    #filter-form-buttons {
        justify-self: end;
        display: flex;
        gap: 1rem;
    }

    #filter-field-choice {
        display: flex;
        gap: 1px;
    }

    #filter-form-help {
        grid-column: 2;
    }

    #filter-form-output-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-height: 2.5rem;
    }

    #filter-form-output-row output {
        flex-grow: 1;
    }

`;

export function initFilterEditor(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const filterForm = document.getElementById('filter-form') as HTMLFormElement;
    const filterFieldset = document.getElementById('filter-fieldset') as HTMLFieldSetElement;
    const filterFieldLabel = document.getElementById('filter-field-label') as HTMLLabelElement;
    const filterFieldTextInput = document.getElementById('filter-field-text') as HTMLInputElement;
    const filterFieldChoiceDiv = document.getElementById('filter-field-choice') as HTMLDivElement;
    const filterCancelButton = document.getElementById('filter-cancel') as HTMLButtonElement;
    const filterApplyButton = document.getElementById('filter-apply') as HTMLButtonElement;
    const filterFormOutput = document.getElementById('filter-form-output') as HTMLOutputElement;
    const filterFormHelpDiv = document.getElementById('filter-form-help') as HTMLDivElement;

    filterCancelButton.onclick = e => {
        e.preventDefault();
        vm.cancelFilter();
    }

    filterApplyButton.onclick = e => {
        e.preventDefault();
        const isChoice = vm.filterForm.fieldValueChoices.length > 0;
        if (!isChoice) {
            vm.filterForm.fieldValue = filterFieldTextInput.value;
        }
        vm.saveFilter();
    }

    return () => {
        const wasHidden = filterForm.style.display === 'none';
        filterForm.style.display = vm.filterForm.showing ? 'grid' : 'none';
        filterFieldset.disabled = !vm.filterForm.enabled;

        const isChoice = vm.filterForm.fieldValueChoices.length > 0;
        filterFieldLabel.textContent = vm.filterForm.fieldName;
        filterFieldLabel.htmlFor = isChoice ? filterFieldChoiceDiv.id : filterFieldTextInput.id;
        filterFieldTextInput.style.display = isChoice ? 'none' : 'block';
        filterFieldChoiceDiv.style.display = isChoice ? 'flex' : 'none';
        LitElement.render(CHOICES_HTML(vm), filterFieldChoiceDiv);

        filterFormHelpDiv.textContent = vm.filterForm.helpText;
        filterFormOutput.textContent = vm.filterForm.outputMessage;
        if (wasHidden && vm.filterForm.showing) {
            console.log('filter form open');
            if (!isChoice && vm.filterForm.fieldValue) filterFieldTextInput.value = vm.filterForm.fieldValue;

            setTimeout(() => { 
                filterFieldTextInput.focus();
                filterFieldTextInput.select(); 
            }, 0); 
        }
    };    
}

//

const CHOICES_HTML = (vm: TailwebAppVM) => {
    return vm.filterForm.fieldValueChoices.map(choice => html`<button class="${choice.id === vm.filterForm.fieldValue ? 'selected' : ''}" @click=${(e: Event) => { e.preventDefault(); vm.selectFilterChoice(choice.id); }} ?disabled="${!vm.filterForm.showing}">${choice.text}</button>`);
};
