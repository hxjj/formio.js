import _ from 'lodash';
import Promise from 'native-promise-only';
import { checkCondition } from '../../utils/utils';
import BaseComponent from '../base/Base';
import Components from '../Components';

export default class NestedComponent extends BaseComponent {
  static schema(...extend) {
    return BaseComponent.schema({}, ...extend);
  }

  constructor(component, options, data) {
    super(component, options, data);
    this.type = 'components';
    this.components = [];
    this.hidden = [];
    this.collapsed = !!this.component.collapsed;
  }

  build(showLabel) {
    this.createElement();
    if (showLabel) {
      this.createLabel(this.element);
    }
    this.addComponents();
  }

  get defaultSchema() {
    return NestedComponent.schema();
  }

  get schema() {
    const schema = super.schema;
    schema.components = [];
    this.eachComponent((component) => schema.components.push(component.schema));
    return schema;
  }

  getComponents() {
    return this.components;
  }

  getAllComponents() {
    return this.getComponents().reduce((components, component) => {
      let result = component;

      if (component && component.getAllComponents) {
        result = component.getAllComponents();
      }

      return components.concat(result);
    }, []);
  }

  /**
   * Perform a deep iteration over every component, including those
   * within other container based components.
   *
   * @param {function} fn - Called for every component.
   */
  everyComponent(fn) {
    const components = this.getComponents();
    _.each(components, (component, index) => {
      if (fn(component, components, index) === false) {
        return false;
      }

      if (typeof component.everyComponent === 'function') {
        if (component.everyComponent(fn) === false) {
          return false;
        }
      }
    });
  }

  /**
   * Perform an iteration over each component within this container component.
   *
   * @param {function} fn - Called for each component
   */
  eachComponent(fn) {
    _.each(this.getComponents(), (component, index) => {
      if (fn(component, index) === false) {
        return false;
      }
    });
  }

  /**
   * Returns a component provided a key. This performs a deep search within the
   * component tree.
   *
   * @param {string} key - The key of the component to retrieve.
   * @param {function} fn - Called with the component once found.
   * @return {Object} - The component that is located.
   */
  getComponent(key, fn) {
    let comp = null;
    this.everyComponent((component, components) => {
      if (component.component.key === key) {
        comp = component;
        if (fn) {
          fn(component, components);
        }
        return false;
      }
    });
    return comp;
  }

  /**
   * Return a component provided the Id of the component.
   *
   * @param {string} id - The Id of the component.
   * @param {function} fn - Called with the component once it is retrieved.
   * @return {Object} - The component retrieved.
   */
  getComponentById(id, fn) {
    let comp = null;
    this.everyComponent((component, components) => {
      if (component.id === id) {
        comp = component;
        if (fn) {
          fn(component, components);
        }
        return false;
      }
    });
    return comp;
  }

  /**
   * Create a new component and add it to the components array.
   *
   * @param component
   * @param data
   */
  createComponent(component, options, data, before) {
    options = options || this.options;
    data = data || this.data;
    const comp = Components.create(component, options, data, true);
    comp.parent = this;
    comp.root = this.root || this;
    comp.build();
    comp.isBuilt = true;
    if (component.internal) {
      return comp;
    }

    if (before) {
      const index = _.findIndex(this.components, { id: before.id });
      if (index !== -1) {
        this.components.splice(index, 0, comp);
      }
      else {
        this.components.push(comp);
      }
    }
    else {
      this.components.push(comp);
    }
    return comp;
  }

  getContainer() {
    return this.element;
  }

  /**
   * Add a new component to the components array.
   *
   * @param {Object} component - The component JSON schema to add.
   * @param {HTMLElement} element - The DOM element to append this child to.
   * @param {Object} data - The submission data object to house the data for this component.
   * @param {HTMLElement} before - A DOM element to insert this element before.
   * @return {BaseComponent} - The created component instance.
   */
  addComponent(component, element, data, before, noAdd) {
    element = element || this.getContainer();
    data = data || this.data;
    const comp = this.createComponent(component, this.options, data, before ? before.component : null);
    if (noAdd) {
      return comp;
    }
    element = this.hook('addComponent', element, comp, this);
    const compElement = comp.getElement();
    if (!compElement) {
      console.warn(`Component ${component.key} has no element.`);
      return comp;
    }
    if (before) {
      element.insertBefore(compElement, before);
    }
    else {
      element.appendChild(compElement);
    }
    this.setHidden(comp);
    return comp;
  }

  /**
   * Remove a component from the components array.
   *
   * @param {BaseComponent} component - The component to remove from the components.
   * @param {Array<BaseComponent>} components - An array of components to remove this component from.
   */
  removeComponent(component, components) {
    components = components || this.components;
    component.destroy();
    const element = component.getElement();
    if (element && element.parentNode) {
      this.removeChildFrom(element, element.parentNode);
    }
    _.remove(components, { id: component.id });
  }

  /**
   * Removes a component provided the API key of that component.
   *
   * @param {string} key - The API key of the component to remove.
   * @param {function} fn - Called once the component is removed.
   * @return {null}
   */
  removeComponentByKey(key, fn) {
    const comp = this.getComponent(key, (component, components) => {
      this.removeComponent(component, components);
      if (fn) {
        fn(component, components);
      }
    });
    if (!comp) {
      if (fn) {
        fn(null);
      }
      return null;
    }
  }

  /**
   * Removes a component provided the Id of the component.
   *
   * @param {string} id - The Id of the component to remove.
   * @param {function} fn - Called when the component is removed.
   * @return {null}
   */
  removeComponentById(id, fn) {
    const comp = this.getComponentById(id, (component, components) => {
      this.removeComponent(component, components);
      if (fn) {
        fn(component, components);
      }
    });
    if (!comp) {
      if (fn) {
        fn(null);
      }
      return null;
    }
  }

  get componentComponents() {
    return this.component.components;
  }

  /**
   *
   * @param element
   * @param data
   */
  addComponents(element, data, options) {
    element = element || this.getContainer();
    data = data || this.data;
    options = options || this.options;

    if (options.components) {
      this.components = options.components;
    }
    else {
      const components = this.hook('addComponents', this.componentComponents, this) || [];
      components.forEach((component) => this.addComponent(component, element, data));
    }
  }

  updateValue(flags) {
    return this.components.reduce((changed, comp) => comp.updateValue(flags) || changed, false);
  }

  hasChanged() {
    return false;
  }

  /**
   * A more performant way to check the conditions, calculations, and validity of
   * a submission once it has been changed.
   *
   * @param data
   * @param flags
   */
  checkData(data, flags) {
    flags = flags || {};
    let valid = true;
    if (flags.noCheck) {
      return;
    }

    // Update the value.
    let changed = this.updateValue({
      noUpdateEvent: true
    });

    // Iterate through all components and check conditions, and calculate values.
    this.getComponents().forEach((comp) => {
      changed |= comp.calculateValue(data, {
        noUpdateEvent: true
      });
      comp.checkConditions(data);
      if (!flags.noValidate) {
        valid &= comp.checkValidity(data);
      }
    });

    // Trigger the change if the values changed.
    if (changed) {
      this.triggerChange(flags);
    }

    // Return if the value is valid.
    return valid;
  }

  checkConditions(data) {
    this.getComponents().forEach((comp) => comp.checkConditions(data));
    return super.checkConditions(data);
  }

  clearOnHide(show) {
    super.clearOnHide(show);
    this.getComponents().forEach((component) => component.clearOnHide(show));
  }

  show(show) {
    const shown = super.show(show);
    const forceShow = this.options.show && this.options.show[this.component.key];
    const forceHide = this.options.hide && this.options.hide[this.component.key];

    if (forceShow || forceHide) {
      this.getComponents().forEach((component) => {
        if (forceShow) {
          component.show(true);
        }
        else if (forceHide) {
          component.show(false);
        }
      });
    }
    // If hiding a nested component, clear all errors below.
    if (!shown) {
      this.getAllComponents().forEach(component => {
        component.error = '';
      });
    }
    return shown;
  }

  /**
   * Allow components to hook into the next page trigger to perform their own logic.
   *
   * @return {*}
   */
  beforeNext() {
    return Promise.all(this.getComponents().map((comp) => comp.beforeNext()));
  }

  /**
   * Allow components to hook into the submission to provide their own async data.
   *
   * @return {*}
   */
  beforeSubmit() {
    return Promise.all(this.getComponents().map((comp) => comp.beforeSubmit()));
  }

  calculateValue(data, flags) {
    return this.getComponents().reduce(
      (changed, comp) => comp.calculateValue(data, flags) || changed,
      super.calculateValue(data, flags)
    );
  }

  isValid(data, dirty) {
    return this.getComponents().reduce(
      (valid, comp) => comp.isValid(data, dirty) && valid,
      super.isValid(data, dirty)
    );
  }

  checkValidity(data, dirty) {
    if (!checkCondition(this.component, data, this.data, this.root ? this.root._form : {}, this)) {
      this.setCustomValidity('');
      return true;
    }

    return this.getComponents().reduce(
      (check, comp) => comp.checkValidity(data, dirty) && check,
      super.checkValidity(data, dirty)
    );
  }

  setPristine(pristine) {
    super.setPristine(pristine);
    this.getComponents().forEach((comp) => comp.setPristine(pristine));
  }

  destroy(all) {
    super.destroy(all);
    this.destroyComponents();
  }

  destroyComponents() {
    const components = this.components.slice();
    components.forEach((comp) => this.removeComponent(comp, this.components));
    this.components = [];
    this.hidden = [];
  }

  set disabled(disabled) {
    this.components.forEach((component) => component.disabled = disabled);
  }

  setHidden(component) {
    if (component.components && component.components.length) {
      component.hideComponents(this.hidden);
    }
    else if (component.component.hidden) {
      component.visible = false;
    }
    else if (this.hidden && this.hidden.includes(component.key)) {
      component.visible = false;
    }
    else if (!component.conditionallyVisible()) {
      component.visible = false;
    }
  }

  hideComponents(hidden) {
    this.hidden = hidden;
    this.eachComponent((component) => this.setHidden(component));
  }

  get errors() {
    return this.getAllComponents().reduce((errors, comp) => errors.concat(comp.errors || []), []);
  }

  getValue() {
    return this.data;
  }

  resetValue() {
    this.getComponents().forEach((comp) => comp.resetValue());
    _.unset(this.data, this.key);
    this.setPristine(true);
  }

  get dataReady() {
    return Promise.all(this.getComponents().map((component) => component.dataReady));
  }

  setNestedValue(component, value, flags, changed) {
    if (component.type === 'button') {
      return false;
    }

    if (component.type === 'components') {
      return component.setValue(value, flags) || changed;
    }
    else if (value && component.hasValue(value)) {
      return component.setValue(_.get(value, component.key), flags) || changed;
    }
    else {
      flags.noValidate = true;
      return component.setValue(component.defaultValue, flags) || changed;
    }
  }

  setValue(value, flags) {
    if (!value) {
      return false;
    }
    flags = this.getFlags.apply(this, arguments);
    return this.getComponents().reduce((changed, component) => {
      return this.setNestedValue(component, value, flags, changed);
    }, false);
  }

  setCollapseHeader(header) {
    if (this.component.collapsible) {
      this.addClass(header, 'formio-clickable');
      this.addEventListener(header, 'click', () => this.toggleCollapse());
    }
  }

  setCollapsed(element) {
    if (!this.component.collapsible) {
      return;
    }

    const container = element || this.getContainer();

    if (this.collapsed) {
      container.setAttribute('hidden', true);
      container.style.visibility = 'hidden';
    }
    else {
      container.removeAttribute('hidden');
      container.style.visibility = 'visible';
    }
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.setCollapsed();
  }
}
