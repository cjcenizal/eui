/**
 * Elements within EuiComboBox which would normally be tabbable (inputs, buttons) have been removed
 * from the tab order with tabindex="-1" so that we can control the keyboard navigation interface.
 */

import React, {
  Component,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import tabbable from 'tabbable';

import { comboBoxKeyCodes } from '../../services';
import { BACKSPACE, TAB, ESCAPE } from '../../services/key_codes';
import { EuiComboBoxInput } from './combo_box_input';
import { EuiComboBoxOptionsList } from './combo_box_options_list';

import {
  getMatchingOptions,
  flattenOptionGroups,
  getSelectedOptionForSearchValue,
} from './matching_options';

export class EuiComboBox extends Component {
  static propTypes = {
    className: PropTypes.string,
    options: PropTypes.array,
    selectedOptions: PropTypes.array,
    onChange: PropTypes.func.isRequired,
    onSearchChange: PropTypes.func,
    onCreateOption: PropTypes.func,
  }

  static defaultProps = {
    options: [],
    selectedOptions: [],
  }

  constructor(props) {
    super(props);

    const initialSearchValue = '';
    const { options, selectedOptions } = props;
    const { matchingOptions, optionToGroupMap } = getMatchingOptions(options, selectedOptions, initialSearchValue);

    this.state = {
      searchValue: initialSearchValue,
      isListOpen: this.props.isListOpen,
    };

    // Cached derived state.
    this.matchingOptions = matchingOptions;
    this.optionToGroupMap = optionToGroupMap;
    this.activeOptionIndex = undefined;

    // Refs.
    this.options = [];
    this.autoSizeInput = undefined;
    this.searchInput = undefined;
  }

  openList = () => {
    this.setState({
      isListOpen: true,
    });
  };

  closeList = () => {
    this.clearActiveOption();
    this.setState({
      isListOpen: false,
    });
  };

  tabAway = amount => {
    const tabbableItems = tabbable(document);
    const comboBoxIndex = tabbableItems.indexOf(this.searchInput);

    // Wrap to last tabbable if tabbing backwards.
    if (amount < 0) {
      if (comboBoxIndex === 0) {
        tabbableItems[tabbableItems.length - 1].focus();
        return;
      }
    }

    // Wrap to first tabbable if tabbing forwards.
    if (amount > 0) {
      if (comboBoxIndex === tabbableItems.length - 1) {
        tabbableItems[0].focus();
        return;
      }
    }

    tabbableItems[comboBoxIndex + amount].focus();
  };

  incrementActiveOptionIndex = amount => {
    // If there are no options available, reset the focus.
    if (!this.matchingOptions.length) {
      this.clearActiveOption();
      return;
    }

    let nextActiveOptionIndex;

    if (!this.hasActiveOption()) {
      // If this is the beginning of the user's keyboard navigation of the menu, then we'll focus
      // either the first or last item.
      nextActiveOptionIndex = amount < 0 ? this.options.length - 1 : 0;
    } else {
      nextActiveOptionIndex = this.activeOptionIndex + amount;

      if (nextActiveOptionIndex < 0) {
        nextActiveOptionIndex = this.options.length - 1;
      } else if (nextActiveOptionIndex === this.options.length) {
        nextActiveOptionIndex = 0;
      }
    }

    this.activeOptionIndex = nextActiveOptionIndex;
    this.focusActiveOption();
  };

  hasActiveOption = () => {
    return this.activeOptionIndex !== undefined;
  };

  clearActiveOption = () => {
    this.activeOptionIndex = undefined;
  };

  focusActiveOption = () => {
    // If an item is focused, focus it.
    if (this.hasActiveOption()) {
      this.options[this.activeOptionIndex].focus();
    }
  };

  doesSearchMatchOnlyOption = () => {
    const { searchValue } = this.state;
    if (this.matchingOptions.length !== 1) {
      return false;
    }
    return this.matchingOptions[0].value.toLowerCase() === searchValue.toLowerCase();
  };

  areAllOptionsSelected = () => {
    const { options, selectedOptions } = this.props;
    return flattenOptionGroups(options).length === selectedOptions.length;
  };

  onKeyDown = (e) => {
    switch (e.keyCode) {
      case comboBoxKeyCodes.UP:
        e.preventDefault();
        this.incrementActiveOptionIndex(-1);
        break;

      case comboBoxKeyCodes.DOWN:
        e.preventDefault();
        this.incrementActiveOptionIndex(1);
        break;

      case BACKSPACE:
        // Delete last pill.
        if (this.props.selectedOptions.length) {
          // Backspace will be used to delete the input, not a pill.
          if (!this.state.searchValue.length) {
            this.onRemoveOption(this.props.selectedOptions[this.props.selectedOptions.length - 1]);
          }
        }
        break;

      case ESCAPE:
        // Move focus from options list to input.
        if (this.hasActiveOption()) {
          this.clearActiveOption();
          this.searchInput.focus();
        }
        break;

      case comboBoxKeyCodes.ENTER:
        if (this.doesSearchMatchOnlyOption()) {
          this.options[0].click();
          return;
        }

        if (!this.props.onCreateOption) {
          return;
        }

        // Don't create the value if it's already been selected.
        if (getSelectedOptionForSearchValue(this.state.searchValue, this.props.selectedOptions)) {
          return;
        }

        // Add new custom pill if this is custom input.
        const isCustomInput = !this.hasActiveOption() && !this.matchingOptions.length;
        if (isCustomInput || this.doesSearchMatchOnlyOption()) {
          this.props.onCreateOption(this.state.searchValue, flattenOptionGroups(this.props.options));
          this.setState({ searchValue: '' });
        }
        break;

      case TAB:
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          this.tabAway(-1);
        } else {
          this.tabAway(1);
        }
        break;
    }
  };

  onComboBoxClick = () => {
    // When the user clicks anywhere on the box, enter the interaction state.
    this.searchInput.focus();
  };

  onOptionEnterKey = (option) => {
    this.onAddOption(option);
  }

  onOptionClick = (option) => {
    this.onAddOption(option);
  }

  onAddOption = (addedOption) => {
    const { onChange, selectedOptions } = this.props;
    onChange(selectedOptions.concat(addedOption));
    this.clearActiveOption();
    this.setState({ searchValue: '' });
    this.searchInput.focus();
  };

  onRemoveOption = (removedOption) => {
    const { onChange, selectedOptions } = this.props;
    onChange(selectedOptions.filter(option => option !== removedOption));
  };

  onComboBoxFocus = (e) => {
    // If the user has tabbed to the combo box, open it.
    if (e.target === this.searchInput) {
      this.searchInput.focus();
      return;
    }

    // If a user clicks on an option without selecting it, then it will take focus
    // and we need to update the index.
    const optionIndex = this.options.indexOf(e.target);
    if (optionIndex !== -1) {
      this.activeOptionIndex = optionIndex;
    }
  };

  onComboBoxBlur = () => {
    // This callback generally handles cases when the user has taken focus away by clicking outside
    // of the combo box.

    // Wait for the DOM to update.
    requestAnimationFrame(() => {
      // If the user has placed focus somewhere outside of the combo box, close it.
      const hasFocus = this.comboBox.contains(document.activeElement);
      if (!hasFocus) {
        this.closeList();
      }
    });
  };

  onSearchChange = (e) => {
    if (this.props.onSearchChange) {
      this.props.onSearchChange();
    }

    this.setState({ searchValue: e.target.value })
  };

  comboBoxRef = node => {
    this.comboBox = node;
  };

  autoSizeInputRef = node => {
    this.autoSizeInput = node;
  };

  searchInputRef = node => {
    this.searchInput = node;
  };

  optionRef = (index, node) => {
    // Sometimes the node is null.
    if (node) {
      // Store all options.
      this.options[index] = node;
    }
  };

  componentDidMount() {
    // TODO: This will need to be called once the actual stylesheet loads.
    setTimeout(() => {
      this.autoSizeInput.copyInputStyles();
    }, 100);
  }

  componentWillUpdate(nextProps, nextState) {
    const { options, selectedOptions } = nextProps;
    const { searchValue } = nextState;

    if (
      options !== this.props.options
      || selectedOptions !== this.props.selectedOptions
      || searchValue !== this.props.searchValue
    ) {
      // Clear refs to options if the ones we can display changes.
      this.options = [];
    }

    // Calculate and cache the options which match the searchValue, because we use this information
    // in multiple places and it would be expensive to calculate repeatedly.
    const { matchingOptions, optionToGroupMap } = getMatchingOptions(options, selectedOptions, nextState.searchValue);
    this.matchingOptions = matchingOptions;
    this.optionToGroupMap = optionToGroupMap;

    if (!matchingOptions.length) {
      this.clearActiveOption();
    }
  }

  componentDidUpdate() {
    this.focusActiveOption();
  }

  render() {
    const {
      className,
      options,
      selectedOptions,
      onChange, // eslint-disable-line no-unused-vars
      onCreateOption,
      onSearchChange, // eslint-disable-line no-unused-vars
      ...rest
    } = this.props;

    const { searchValue } = this.state;

    const classes = classNames('euiComboBox', className, {
      'euiComboBox-isOpen': this.state.isListOpen,
    });

    return (
      <div
        className={classes}
        onBlur={this.onComboBoxBlur}
        onFocus={this.onComboBoxFocus}
        onKeyDown={this.onKeyDown}
        ref={this.comboBoxRef}
        {...rest}
      >
        <EuiComboBoxInput
          selectedOptions={selectedOptions}
          onRemoveOption={this.onRemoveOption}
          onClick={this.onComboBoxClick}
          onChange={this.onSearchChange}
          onFocus={this.openList}
          value={searchValue}
          autoSizeInputRef={this.autoSizeInputRef}
          inputRef={this.searchInputRef}
        />

        <EuiComboBoxOptionsList
          options={options}
          selectedOptions={selectedOptions}
          onCreateOption={onCreateOption}
          searchValue={searchValue}
          matchingOptions={this.matchingOptions}
          optionToGroupMap={this.optionToGroupMap}
          optionRef={this.optionRef}
          onOptionClick={this.onOptionClick}
          onOptionEnterKey={this.onOptionEnterKey}
          areAllOptionsSelected={this.areAllOptionsSelected()}
          getSelectedOptionForSearchValue={getSelectedOptionForSearchValue}
        />
      </div>
    );
  }
}
