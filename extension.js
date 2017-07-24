const vscode = require('vscode');
const Range = vscode.Range;
const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');

function activate(context) {
    var disposable = vscode.commands.registerCommand('extension.simpleJump', function () {
        listUpMatch();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;

/**
 * 実行関数
 */
function listUpMatch(){
    let editor = vscode.window.activeTextEditor;
    if(editor === undefined){
        return;
    }
    var fileExtention = getFileNameExtention(editor.document.fileName);
    var selected = editor.selections[0];
    if(!selected){
        return;
    }
    //検索対象単語を取得
    var targetWord = editor.document.getText(new Range(selected.start,selected.end));
    var rootPath = vscode.workspace.rootPath;
    
    //ワークスペース配下にあるファイル・フォルダを取得
    getDirList(rootPath)
    .then(function(dirList){
        //フォルダ一覧を取得
        return getFolderList(dirList,rootPath);
    },function(err){
        console.log(err);
    }).then(function(folderList){
        //検索結果一覧を取得
        return getMatchList(folderList,rootPath,targetWord,fileExtention);
    },function(err){
        console.log(err);
    }).then(function(matchList){
        //コマンドパレットに表示するリストを作成
        var showItems = [];
        matchList.forEach(function(match){
            showItems.push({label:match.fileName + ' Line:' + match.lineNum,description:match});
        });
        vscode.window.showQuickPick(showItems,{placeHolder:'Find Results'})
        .then(function(selected){
            //選択されたファイルを開く
            return new Promise(function(resolve, reject){
                vscode.workspace.openTextDocument(selected.description.fileName)
                .then(function(file){
                    resolve({file:file,selectedItem:selected.description});
                });
            });
        }).then(function(result){
            //選択されたファイルを表示する
            return new Promise(function(resolve, reject){
                vscode.window.showTextDocument(result.file)
                .then(function(editor){
                    resolve({editor:editor,selectedItem:result.selectedItem});
                });
            });
        }).then(function(result){
            //表示位置を選択された位置に設定
            var lineNum = result.selectedItem.lineNum;
            vscode.commands.executeCommand('revealLine', {lineNumber:lineNum,at:'center'});
            //カーソルを選択された位置に設定
            var pos = new vscode.Position(lineNum-1,0);
            var sel = new vscode.Selection(pos, pos);
            result.editor.selection = sel;
        });
    },function(err){
        console.log(err);
    });
}
/**
 * ファイルの拡張子を取得する
 * @param {string} file ファイルのフルパス 
 */
function getFileNameExtention(file){
    return file.slice(file.lastIndexOf('.')+1);
}
/**
 * 検索対象フォルダか判定する
 * @param {string} dir フォルダパス 
 */
function isTargetDir(dir){
    //var targetDir = [];
    return true;
}
function asyncForEach(list,i,len){
    return new Promise(function(resolve, reject){
        for(;i<len;i++){
            
        }
    });
}
/**
 * 検索を行う
 * @param {array} folderList 検索対象のフォルダ一覧
 * @param {string} path プロジェクトのルートパス
 * @param {string} targetWord 検索対象単語
 * @param {string} fileExtention 検索対象ファイルの拡張子
 */
function getMatchList(folderList,path,targetWord,fileExtention){
    return new Promise(function(resolve, reject){
        //フォルダ内のファイルを順に検索
        var matchList = [];
        var promiseList = [];
        folderList.forEach(function(folder){
            if(isTargetDir(folder)){
                promiseList.push(findWord(path + '/' + folder,targetWord,fileExtention));
            }
        });
        //フォルダ・ファイルごとの検索結果から1つの検索結果配列を作成する
        Promise.all(promiseList)
        .then(function(dirList){
            dirList.forEach(function(fileList){
                fileList.forEach(function(lineList){
                    matchList = matchList.concat(lineList);
                });
            });
            resolve(matchList);
        },function(er){
            reject(er);
        });
    });
    
}
/**
 * ファイル・フォルダ一覧を返す
 * @param {string} path 検索対象のパス
 */
function getDirList(path){
    return new Promise(function(resolve, reject){
        fs.readdir(path,function(err,dirList){
            if (err) {
                reject(err);
                return;
            }
            resolve(dirList);
        });
    });
}
/**
 * フォルダのみの一覧を取得する
 * @param {array} dirList ファイル・フォルダ一覧
 * @param {string} path ルートパス
 */
function getFolderList(dirList,path){
    return new Promise(function(resolve, reject){   
        var promiseList = [];
        dirList.forEach(function(dir){
            promiseList.push(getStats(path,dir));
        });
        Promise.all(promiseList)
        .then(function(statsList){
            //フォルダのみ配列に追加
            var folderList = [];
            statsList.forEach(function(stats){
                if(stats['stat'].isDirectory()){
                    folderList.push(stats['dir']);
                }
            });
            resolve(folderList);
        },function(er){
            reject(er);
        });

    });
}
/**
 * フォルダのステータスオブジェクト{dir:フォルダ,stat:statsオブジェクト}を返す
 * @param {string} path ルートパス 
 * @param {string} dir 判定対象フォルダ
 */
function getStats(path,dir){
    return new Promise(function(resolve,reject){
        fs.stat(path  + '/' + dir,function(err,stats){
            if (err){
                reject(err);
                return;
            }
            var result = {'dir':dir,'stat':stats};
            resolve(result);
        });  
    });
}
/**
 * フォルダ内のファイルをグレップする
 * @param {string} dir フォルダ
 * @param {string} target 検索対象単語
 * @param {string} fileExtention 検索対象ファイル拡張子
 */
function findWord(dir,target,fileExtention) {
    return new Promise(function(resolve,reject){
        //ファイル一覧を取得
        getFiles(dir)
        .then(function(fileList){
            //ファイル内を検索
            var promiseList = [];
            fileList.forEach(function(file) {
                if(getFileNameExtention(file) == fileExtention){
                    promiseList.push(readStream(dir + '/' + file,target));
                }
            }, this);
            Promise.all(promiseList)
            .then(function(findLineList){
                resolve(findLineList);
            },function(er){
                reject(er);
            });
        });
    });
}
/**
 * フォルダ内のファイル一覧を返す
 * @param {string} dir フォルダ 
 */
function getFiles(dir){
    return new Promise(function(resolve,reject){
        fs.readdir(dir,function(err,fileList){
            if (err){
                reject(err);
                return;
            }
            resolve(fileList);            
        });
    });
}
/**
 * ファイルを読み込み単語を検索する
 * @param {string} file ファイルのフルパス
 * @param {string} target 検索対象単語
 */
function readStream(file,target){
    return new Promise(function(resolve,reject){
        var findLineList = [];
        var read = fs.createReadStream(file);
        var lineCnt = 0;
        var preLastLine = '';
        read.on('data',function(bufData){
            //bufferをstringに変換して読み込む
            var textStr = decoder.write(bufData);
            var lineList = textStr.split(/\r\n|\r|\n/);
            lineList[0] = preLastLine + lineList[0];
            //文字列の最後に改行がなければ先頭の文字列と結合
            if(lineList.length != lineList[lineList.length-1].lastIndexOf('¥n')+1){
                preLastLine = lineList[lineList.length-1];
            }else{
                preLastLine = '';
            }
            lineList.forEach(function(line){
                lineCnt++;
                if(line.match(target)){
                    findLineList.push({'fileName':file,'lineNum':lineCnt});
                }
            });
        }).on('end',function(){
            resolve(findLineList);            
        }).on('error',function(err){
            reject(err);
            return;
        //}).on('close',function(){
        });
    });
}