/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html, LitElement, svg } from '../deps_app.ts';
import { Material } from '../material.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const FILTER_EDITOR_HTML = html`
<form id="filter-form" autocomplete="off">
<fieldset id="filter-fieldset">
  <div id="filter-form-title" class="h6 high-emphasis-text">Edit filter</div>

  <label id="filter-field-label">Filter field:</label>
  <input id="filter-field-text" type="text">
  <div id="filter-field-choice"></div>
  <div id="filter-field-options"></div>

  <div id="filter-form-help" class="body2 medium-emphasis-text">
  </div>  

  <div id="filter-form-output-row" class="form-row">
    <output id="filter-form-output"></output>
  </div>

  <div id="filter-form-buttons" class="form-rhs">
    <button id="filter-apply" type="submit">Apply</button><!-- first so it is default button on return -->
    <button id="filter-cancel">Cancel</button>
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
        flex-direction: row-reverse;
        gap: 1rem;
    }

    #filter-field-choice {
        display: flex;
        gap: 1px;
    }

    #filter-field-options {
        display: flex;
        gap: 1px;
    }

    #filter-field-options button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
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
    const filterFieldOptionsDiv = document.getElementById('filter-field-options') as HTMLDivElement;
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
        const type = computeType(vm);
        if (type === 'text') {
            vm.filterForm.fieldValue = filterFieldTextInput.value;
        }
        vm.saveFilter();
    }

    return () => {
        const wasHidden = filterForm.style.display === 'none';
        filterForm.style.display = vm.filterForm.showing ? 'grid' : 'none';
        filterFieldset.disabled = !vm.filterForm.enabled;

        const type = computeType(vm);
        filterFieldLabel.textContent = vm.filterForm.fieldName;
        
        filterFieldLabel.htmlFor = type == 'choice' ? filterFieldChoiceDiv.id : type == 'options' ? filterFieldOptionsDiv.id : filterFieldTextInput.id;
        filterFieldTextInput.style.display = type == 'text' ? 'block' : 'none';
        filterFieldChoiceDiv.style.display = type == 'choice' ? 'flex' : 'none';
        LitElement.render(CHOICES_HTML(vm), filterFieldChoiceDiv);
        filterFieldOptionsDiv.style.display = type == 'options' ? 'flex' : 'none';
        LitElement.render(OPTIONS_HTML(vm), filterFieldOptionsDiv);

        filterFormHelpDiv.textContent = vm.filterForm.helpText;
        filterFormOutput.textContent = vm.filterForm.outputMessage;
        if (wasHidden && vm.filterForm.showing) {
            console.log('filter form open');
            if (type === 'text' && vm.filterForm.fieldValue) filterFieldTextInput.value = vm.filterForm.fieldValue;

            setTimeout(() => { 
                filterFieldTextInput.focus();
                filterFieldTextInput.select(); 
            }, 0); 
        }
    };    
}

//

function computeType(vm: TailwebAppVM): 'choice' | 'options' | 'text' {
    return vm.filterForm.fieldValueChoices.length > 0 ? 'choice' 
        : vm.filterForm.fieldValueOptions.length ? 'options' 
        : 'text';
}

const CHOICES_HTML = (vm: TailwebAppVM) => {
    return vm.filterForm.fieldValueChoices.map(choice => html`<button class="${choice.id === vm.filterForm.fieldValue ? 'selected' : ''}" @click=${(e: Event) => { e.preventDefault(); vm.selectFilterChoice(choice.id); }} ?disabled="${!vm.filterForm.showing}">${choice.text}</button>`);
};

const OPTIONS_HTML = (vm: TailwebAppVM) => {
    return vm.filterForm.fieldValueOptions.map(option => {
        const selected = fieldValueSet(vm).has(option.id);
        return html`<button class="${selected ? 'selected' : ''}" @click=${(e: Event) => { e.preventDefault(); vm.toggleFilterOption(option.id); }} ?disabled="${!vm.filterForm.showing}">${selected ? CHECK_BOX_CHECKED_ICON : CHECK_BOX_UNCHECKED_ICON} ${option.text}</button>`;
    });
};

function fieldValueSet(vm: TailwebAppVM): Set<string> {
    return new Set((vm.filterForm.fieldValue || '').split(',').map(v => v.trim()).filter(v => v.length > 0));
}

const CHECK_BOX_UNCHECKED_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
const CHECK_BOX_CHECKED_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`;
