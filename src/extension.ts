// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { window, commands, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument } from 'vscode';
import { setInterval, clearInterval } from 'timers';
import * as fs from 'fs';
import * as vscode from 'vscode';
import Window = vscode.window;
import QuickPickItem = vscode.QuickPickItem;
import QuickPickOptions = vscode.QuickPickOptions;

const path = require('path');
/*const remote = require('electron').remote
const app = remote.app;*/

//var vscode = require('vscode');



// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.

    //let now = new Date();    
    console.log('Congratulations, your extension "WordCount" is now active!');

    // create a new word counter
    let wordCounter = new WordCounter();
    let controller = new WordCounterController(wordCounter);

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(controller);
    context.subscriptions.push(wordCounter);

    vscode.commands.registerCommand('extension.csakexttimerFunctions', csakexttimerFunctions);
}

class Config {

    private _hoursperday: number;

    constructor() {
        this.loadConfig();
    }

    loadConfig(path?) {
        let obj = {};
        let _path = path ? path : __dirname + '/../config.json';
        if (fs.existsSync(_path)) {
            obj = JSON.parse(fs.readFileSync(_path, 'utf8'));
            this._hoursperday = (<any>obj).hoursperday;
        } else {
            this._hoursperday = 0;
        }
    }

    saveConfig(path?) {
        let _path = path ? path : __dirname + '/../config.json';
        let obj = {
            hoursperday: this._hoursperday
        }
        fs.writeFileSync(_path, JSON.stringify(obj), 'utf8');
    }

    get hoursperday() {
        return this._hoursperday;
    }

    set hoursperday(value) {
        this._hoursperday = value;
    }

}

var globalConfig: Config;

class WordCounter {

    private _statusBarItem: StatusBarItem;

    private getFullDateTimeText(secnum) {
        var seconds = secnum;
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);

        hours = hours - (days * 24);
        minutes = minutes - (days * 24 * 60) - (hours * 60);
        seconds = seconds - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);

        function padding(num) {
            let result = '';
            result = num < 1000 ? '000' + num : num;
            result = num < 100 ? '00' + num : num;
            result = num < 10 ? '0' + num : num;
            return result;
        }

        if (globalConfig.hoursperday && globalConfig.hoursperday > 0) {
            days = Math.floor((days * 24 + hours) / globalConfig.hoursperday); //8 hour per workday
            hours = hours - (days * 8);
            return `${days} day + ${padding(hours)}:${padding(minutes)}:${padding(seconds)}`;
        }

        return `${padding(hours + (days * 24))}:${padding(minutes)}:${padding(seconds)}`;
    }

    public updateWordCount(time, inactive = '') {

        // Create as needed
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }

        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        let doc = editor.document;

        // Only update status if an Markdown file
        /* if (doc.languageId === "markdown") {
             let wordCount = this._getWordCount(doc);
 
             // Update the status bar
             this._statusBarItem.text = wordCount !== 1 ? `${wordCount} Words` : '1 Word';
             this._statusBarItem.show();
         } else {
             this._statusBarItem.hide();
         }*/


        let wordCount = this._getWordCount(doc);

        // Update the status bar
        //this._statusBarItem.text = wordCount !== 1 ? `${wordCount} Words` : '1 Word';
        this._statusBarItem.text = `Elapsed time: ${this.getFullDateTimeText(time)} sec ${inactive}`
        this._statusBarItem.show();

    }

    public _getWordCount(doc: TextDocument): number {

        let docContent = doc.getText();

        // Parse out unwanted whitespace so the split is accurate
        docContent = docContent.replace(/(< ([^>]+)<)/g, '').replace(/\s+/g, ' ');
        docContent = docContent.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        let wordCount = 0;
        if (docContent != "") {
            wordCount = docContent.split(" ").length;
        }

        return wordCount;
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}

var instance: WordCounterController;

class WordCounterController {

    private _wordCounter: WordCounter;
    private _disposable: Disposable;
    public starttime: Date;
    public lasttime: Date;
    public interval: NodeJS.Timer;
    public totaltime: number = 0;
    public timerisactive: boolean = false;

    public logfile: string = '';

    private config: object;

    private heartbeat() {

    }

    private writeFile() {
        //debugger
        var fs = require('fs');
        var json = JSON.stringify(
            {
                starttime: this.starttime.toLocaleString(),
                totaltimesec: this.totaltime,
                lasttime: this.lasttime.toLocaleString()
            }, null, 4
        );
        //fs.writeFileSync(app.getAppPath() + '/vscode/csak-timelog.json', json, 'utf8');
        fs.writeFileSync(this.logfile, json, 'utf8');
    }

    private readFile() {
        if (fs.existsSync(this.logfile)) {
            var obj = JSON.parse(fs.readFileSync(this.logfile, 'utf8'));
            this.starttime = obj.starttime;
            this.totaltime = obj.totaltimesec;
            this.lasttime = obj.lasttime;
        }
    }

    private startTimer() {
        this.timerisactive = true;
        let interval2: NodeJS.Timer;
        let that = this;
        this.interval = setInterval(() => {
            that.totaltime++;
            let inactivetext = '';
            if (that.getElapsedTime2(that.lasttime, new Date()) > 600) {
                clearInterval(interval2);
                inactivetext = '(Inactive)'
                that.timerisactive = false;
            }
            that._wordCounter.updateWordCount(that.totaltime, inactivetext);

            if (Math.round(that.totaltime / 60) == that.totaltime / 60) {
                that.writeFile();
            }
        }, 1000)
        interval2 = this.interval;
    }

    constructor(wordCounter: WordCounter) {
        instance = this;
        this.starttime = new Date();
        this.lasttime = this.starttime;

        globalConfig = new Config();
        globalConfig.loadConfig();


        /*  setTimeout(() => {
              this._wordCounter.updateWordCount(this.getElapsedTime());
          },  1);*/

        console.log('Start at', this.starttime.toLocaleTimeString());
        this._wordCounter = wordCounter;


        //console.log(vscode.workspace.workspaceFolders.length);

        if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document) {
            return;
        }
        //set logfile path
        // var s = path.normalize(vscode.window.activeTextEditor.document.fileName);
        var p = vscode.workspace.workspaceFolders[0].uri.fsPath
        var folderpath = p.split('\\').pop();
        if (folderpath != '.vscode') {
            folderpath = p + '/.vscode'
        } else {
            folderpath = p;
        }
        if (!fs.existsSync(folderpath)) {
            fs.mkdirSync(folderpath);
        }
        this.logfile = folderpath + '/csak-timelog.json';


        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        vscode.workspace.onDidSaveTextDocument(this._onSaveDocument, subscriptions);

        // update the counter for the current file
        this._wordCounter.updateWordCount(this.getElapsedTime());

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);

        this.startTimer();
        this.readFile();
        this.writeFile();
    }

    dispose() {
        this._disposable.dispose();
    }

    private getElapsedTime() {
        let endTime = new Date();
        var timeDiff = endTime.valueOf() - this.starttime.valueOf(); //in ms
        // strip the ms
        timeDiff /= 1000;
        // get seconds 
        var seconds = Math.round(timeDiff);
        return seconds;
    }

    private getElapsedTime2(date1: Date, date2: Date) {
        let endTime = date2;
        var timeDiff = endTime.valueOf() - date1.valueOf(); //in ms
        // strip the ms
        timeDiff /= 1000;
        // get seconds 
        var seconds = Math.round(timeDiff);
        return seconds;
    }

    private _onSaveDocument(e: TextDocument) {
        instance.writeFile();
    }

    private _onEvent() {
        this.lasttime = new Date();
        if (!this.timerisactive) {
            this.startTimer();
        }
        //this._wordCounter.updateWordCount(this.getElapsedTime());

    }
}


// Main menu /////////////////////////////////////
function csakexttimerFunctions() {

    /*if (!vscode.window.activeTextEditor) {
		vscode.window.showInformationMessage('Open a file first to manipulate text selections');
		return;
	}*/

    var opts: QuickPickOptions = { matchOnDescription: true, placeHolder: "Spent timer" };
    var items: QuickPickItem[] = [];

    items.push({ label: "saveConfig", description: "save hour setting to config file" });
    items.push({ label: "loadConfig", description: "load hour setting from config file" });

    Window.showQuickPick(items).then((selection) => {
        if (!selection) {
            return;
        }
        let e = Window.activeTextEditor;
        let d = e.document;
        let sel = e.selections;

        switch (selection.label) {
            case "saveConfig":
                vscode.window.showInputBox({ prompt: 'Hours per day' }).then(
                    val => {
                        let i = parseInt(val);
                        globalConfig.hoursperday = i;
                        globalConfig.saveConfig();
                        vscode.window.showInformationMessage('Current hours per day is: ' + i);
                    }
                );
                break;
            case "loadConfig":
                globalConfig.loadConfig();
                vscode.window.showInformationMessage('Current hours per day is:  ' + globalConfig.hoursperday)
                break;
            default:
                console.log("?")
                break;
        }
    });

}