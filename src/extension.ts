// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { window, commands, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument } from 'vscode';
import { setInterval, clearInterval } from 'timers';
import * as fs from 'fs';
import * as vscode from 'vscode';

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
}

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
        days = Math.floor((days * 24 + hours) / 8); //8 hour per workday

        function padding(num) {
            return num < 10 ? '0' + num : num;
        }

        return `${days} day ${padding(hours)}:${padding(minutes)}:${padding(seconds)}`;
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

