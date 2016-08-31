// Type definitions for Alertify.js v1.0.11
// Project: https://github.com/alertifyjs/alertify.js
// Definitions by: Vlad Jerca <https://github.com/vladjerca>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

interface IAlertify {
    reset(): IAlertify;
    dialog(message: string, buttons?: any): IAlertify;
    alert(message: string, okButton?: any, cancelButton?: any): IAlertify;
    confirm(message: string, okButton?: any, cancelButton?: any): IAlertify;
    prompt(message: string, okButton?: any, cancelButton?: any): IAlertify;
    log(message: string, click?: Function, type?: string): IAlertify;
    success(message: string, click?: Function): IAlertify;
    error(message: string, click?: Function): IAlertify;
    theme(themeName: string): IAlertify;
    dialogWidth(width: Number|string): IAlertify;
    dialogPersistent(bool: Boolean): IAlertify;
    dialogContainerClass(str: string): IAlertify;
    cancelBtn(label: string): IAlertify;
    okBtn(label: string): IAlertify;
    delay(time: Number): IAlertify;
    placeholder(str: string): IAlertify;
    defaultValue(str: string): IAlertify;
    maxLogItems(max: Number): IAlertify;
    closeLogOnClick(bool: Boolean): IAlertify;
    logPosition(position: string): IAlertify;
    logContainerClass(str: string): IAlertify;
    setLogTemplate(template: string): IAlertify;
    clearDialogs(): IAlertify;
    clearLogs(): IAlertify;
    parent(prt: HTMLElement): IAlertify;
}

declare var alertify: IAlertify;

declare module "alertify" {
    export default alertify;
}
