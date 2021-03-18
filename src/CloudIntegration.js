/*
1. Duplicate ./CloudIntegrationConfig.js.sample as ./CloudIntegrationConfig.js
2. Fill in values
 */

if(typeof CLOUD_INTEGRATION_CONFIG === 'undefined'){
    throw new Error("Can't find Cloud Integration Configuration. Make sure to duplicate src/CloudIntegrationConfig.js.sample as src/CloudIntegrationConfig.js and fill in the appropriate values.")
}

var CloudIntegration = function(label){
    this.init(label);
}

CloudIntegration.prototype.init = function(label){
    this.label = label;
    this.signedIn = false;
}

CloudIntegration.prototype.getSnapFiles = function(){
    return new Promise((resolve, reject)=>{
        reject('Implement getSnapFiles!');
    })
}

CloudIntegration.prototype.downloadFile = function(id){
    return new Promise((resolve, reject)=>{
        reject('Implement downloadFile!')
    })
}

CloudIntegration.prototype.uploadSnapFile = function(name, body){
    return new Promise((resolve, reject)=>{
        reject('Implement uploadSnapFile!');
    });
}

CloudIntegration.prototype.showSignIn = function(ide){
    return new Promise((resolve, reject)=>{
        reject('Implement showSignIn!');
    })
}

//////////////////

var CloudIntegrationProject = function(params){
    this.init(params);
}

CloudIntegrationProject.prototype.init = function(params){
    if(!params){
        params = {};
    }

    this.name = params.name || null;
    this.id = params.id || null;
    this.lastupdated = params.lastupdated || null;
    this.ispublic = !!params.ispublic;
}

//////////////////

var GoogleProject;

GoogleProject.prototype = new CloudIntegrationProject();
GoogleProject.prototype.constructor = GoogleProject;
GoogleProject.uber = CloudIntegrationProject.prototype;

function GoogleProject(params){
    this.init(params);
}

GoogleProject.prototype.init = function(params) {

    // initialize inherited properties:
    GoogleProject.uber.init.call(this, params);

    this.canShare = !!params.canShare;
    this.currentPublicPermissionId = params.currentPublicPermissionId || null;
    this.currentPublicPermissionType = params.currentPublicPermissionType || null;


}


//////////////////

var GoogleConnection;

GoogleConnection.prototype = new CloudIntegration();
GoogleConnection.prototype.constructor = GoogleConnection;
GoogleConnection.uber = CloudIntegration.prototype;

function GoogleConnection(options){
    this.init(options, 'Google Drive');
}

GoogleConnection.prototype.init = function(options, label){
    // initialize inherited properties:
    GoogleConnection.uber.init.call(this, label);

    this.clientId = options.clientId;
    this.apiKey = options.apiKey;
    this.file = null;

    var apiUrl = 'https://apis.google.com/js/api.js';
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = apiUrl;

    var myself = this;
    script.onload = function(){myself.handleClientLoad()};
    document.body.append(script);
}

GoogleConnection.prototype.handleClientLoad = function(){
    var myself = this;
    gapi.load('client:auth2', function(){
        myself.initClient();
    });
}

GoogleConnection.prototype.initClient = function(){
    var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    var SCOPES = 'https://www.googleapis.com/auth/drive';

    var myself = this;

    gapi.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(function(signedIn){
            myself.updateSigninStatus(signedIn);
        });
        //
        // // Handle the initial sign-in state.
        myself.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

        // authorizeButton.onclick = handleAuthClick;
        // signoutButton.onclick = handleSignoutClick;
    }, function(error) {
       throw new Error(error);
    });
}

GoogleConnection.prototype.getUserInfo = function(){
    if(this.signedIn){
        var profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();

        return {
            domain: profile.getEmail().split('@')[1]
        }
    }
    return null;
}

GoogleConnection.prototype.showSignIn = function(ide){
    return ide.showGoogleSignIn();
}

GoogleConnection.prototype.getSnapFolder = function(){
    return new Promise((resolve, reject)=>{
        gapi.client.drive.files.list({
            q: "name = 'Snap' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        }).then((response)=>{
            var files = response.result.files;
            if(files && files.length>0){
                resolve(files[0].id);
            }
            else{
                gapi.client.drive.files.create({
                    name: 'Snap',
                    mimeType: 'application/vnd.google-apps.folder'
                }).then((response)=>{
                    resolve(response.result.id);
                }, (e)=>reject(e));
            }
        }, (e)=> reject(e));
    });
}

GoogleConnection.prototype.getSnapFiles = function(){
    return new Promise((resolve, reject)=>{
        this.getSnapFolder().then((folderId)=>{
            var retrievePageOfFiles = function (params, result){
                gapi.client.drive.files.list(params).then(function(response){
                    var files = response.result.files;
                    if (files && files.length > 0) {
                        for (var i = 0; i < files.length; i++) {
                            var file = files[i];

                            var canShare = file.capabilities.canShare;
                            var currentPublicPermissionId = null;

                            var currentPublicPermissionType = null;

                            for(let permission of file.permissions){
                                if(permission.type === 'anyone' || permission.type === 'domain'){
                                    currentPublicPermissionId = permission.id;
                                    currentPublicPermissionType = permission.type;
                                }
                            }

                            result.push(new GoogleProject({
                                name: file.name.replace('.xml',''),
                                id: file.id,
                                lastupdated: new Date(file.modifiedTime).toLocaleString(),
                                canShare,
                                currentPublicPermissionId,
                                currentPublicPermissionType

                            }));


                        }
                    }
                    if(response.result.nextPageToken){
                        params['pageToken'] = response.result.nextPageToken;
                        retrievePageOfFiles(params, result);
                    }
                    else{
                        resolve(result);
                    }
                }, (e)=>{reject (e)})
            }

            retrievePageOfFiles({
                'q': "mimeType = 'text/xml' and fullText contains 'app=\"Snap' and '"+folderId+"' in parents and trashed = false",
                'pageSize': 100,
                'fields': "nextPageToken, files(id, name, modifiedTime, permissions, capabilities)",
            }, []);
        }, (e)=>reject(e));
    })
}


GoogleConnection.prototype.downloadFile = function(id){
    return new Promise((resolve, reject)=>{
        var accessToken = gapi.auth.getToken().access_token;
        var xhr = new XMLHttpRequest();
        // hard-coded URL because of issue described here:
        // https://support.google.com/chrome/thread/29767271?hl=en
        xhr.open('GET', 'https://www.googleapis.com/drive/v2/files/'+id+'?alt=media&source=downloadUrl');
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
        xhr.onload = function() {
            resolve(xhr.responseText);
        };
        xhr.onerror = function() {
            reject(null);
        };
        xhr.send();

    })


}

GoogleConnection.prototype.changeSharing = function (file, mode){
    return new Promise((resolve, reject)=>{
        if(mode === 'unshare'){
            this.unshareFile(file.id, file.currentPublicPermissionId, (data)=>{
                file.currentPublicPermissionId = null;
                file.currentPublicPermissionType = null;
                resolve(data);
            }, reject)
        }
        else{

            if(file.currentPublicPermissionId){
                // remove previous public permission first to avoid confusing Google Drive
                this.shareFile(file.id, mode, (data)=>{
                    this.unshareFile(file.id, file.currentPublicPermissionId, ()=>{
                        file.currentPublicPermissionId = data;
                        file.currentPublicPermissionType = mode;
                        resolve(data);
                    }, reject);
                }, reject)
            }

            else{
                this.shareFile(file.id, mode, (data)=>{
                    file.currentPublicPermissionId = data;
                    file.currentPublicPermissionType = mode;
                    resolve(data)
                }, reject);
            }

        }
    });
}

GoogleConnection.prototype.unshareFile = function(fileId, permissionId, onSuccess, onFail){
    gapi.client.drive.permissions.delete({fileId, permissionId}).then((data)=>{
        onSuccess();
    }, (data)=>{
        onFail(data);
    });
}

GoogleConnection.prototype.shareFile = function (fileId, permissionType, onSuccess, onFail){
    var params = {
            fileId,
            role: 'reader',
            type:permissionType
        };

    if(permissionType === 'domain'){
        params['domain'] = this.getUserInfo().domain;
    }

    gapi.client.drive.permissions.create(params).then((data)=>{
        onSuccess(data.result.id);
    }, (data)=>{
        onFail(data);
    });
}

GoogleConnection.prototype.updateSigninStatus = function(isSignedIn){
    if(isSignedIn){
        this.signedIn = true;
    }
    else{
        this.signedIn = false;
    }
}

GoogleConnection.prototype.uploadSnapFile = function(name, body){

    return new Promise((resolve, reject)=>{

        this.getSnapFolder().then((folderId)=>{

            gapi.client.drive.files.list({
                q: "name = '"+name+".xml' and trashed = false"
            }).then((response)=>{

                var fileSuffix = '';
                var method = 'POST';
                var files = response.result.files;

                if(files && files.length>0){
                    fileSuffix = '/'+files[0].id;
                    method = 'PATCH';
                }

                var file = new Blob([body], {type: 'text/xml'});
                var metadata = {
                    'name': name+'.xml', // Filename at Google Drive
                    'mimeType': 'text/xml', // mimeType at Google Drive
                };

                if(method === 'POST'){
                    metadata['parents'] = [folderId]
                }

                var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
                var form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', file);

                fetch('https://www.googleapis.com/upload/drive/v3/files'+fileSuffix+'?uploadType=multipart&fields=id', {
                    method: method,
                    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                    body: form,
                }).then((res) => {
                    return res.json();
                }).then(function(val) {
                    resolve(val);
                });
            }, (e)=>reject(e));


        }, (e)=>reject(e));

    })
}



// NOTE: For production, this dialog needs to be updated to follow Google's branding guidelines:
// https://developers.google.com/identity/branding-guidelines
IDE_Morph.prototype.showGoogleSignIn = function(){

    var myself = this;

    return new Promise((resolve, reject)=>{
        var textString = "Click below to authorize a connection to Google Drive.",
            title = 'Connect to Google Drive';

        var world = this.world();

        var dialog = new DialogBoxMorph();

        var txt = new TextMorph(
            textString,
            dialog.fontSize,
            dialog.fontStyle,
            true,
            false,
            'center',
            null,
            null,
            MorphicPreferences.isFlat ? null : new Point(1, 1),
            WHITE
        );
        if (!dialog.key) {
            dialog.key = 'inform' + title + textString;
        }
        txt.enableLinks = true; // let the user click on URLs to open in new tab
        dialog.labelString = title;
        dialog.createLabel();
        if (textString) {
            dialog.addBody(txt);
        }
        dialog.addButton(function(){
            gapi.auth2.getAuthInstance().signIn()
                .then(function(){
                    dialog.destroy();
                    myself.cloudConnections['google'].updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
                    resolve();
                }, function(e){
                    reject(e);
                });
        }, 'Sign in with Google');

        dialog.addButton('cancel', 'Cancel');
        dialog.fixLayout();
        dialog.popUp(world);

    });

}

IDE_Morph.prototype.saveProjectToCloudConnection = function (name) {

    var cloudConnection = this.cloudConnections[this.source.split(':')[1]];

    return new Promise((resolve, reject)=>{
        var projectBody;

        if (name) {
            this.setProjectName(name);
        }

        this.showMessage('Saving project\nto '+cloudConnection.label+' ...');
        try{
            projectBody = this.serializer.serialize(this.stage);
            this.showMessage(
                'Uploading...'
            );
            cloudConnection.uploadSnapFile(this.projectName, projectBody).then((id)=>{
                this.showMessage('saved.', 2);
                resolve(id);
            }, (e)=>{
                this.showMessage('error uploading', 2);
                reject(e);
            });
        }
        catch(err){
            reject(err);
            if (Process.prototype.isCatchingErrors) {
                this.showMessage('Export failed: ' + err);
            } else {
                throw err;
            }
        }

    })

};

ProjectDialogMorph.prototype.saveCloudIntegrationProject = function () {
    this.ide.saveProjectToCloudConnection().finally(()=>{
        this.destroy();
    });

};

// @override
var originalInit = IDE_Morph.prototype.init;
IDE_Morph.prototype.init = function(){
    originalInit.call(this);
    this.cloudConnections = {}

    if(CLOUD_INTEGRATION_CONFIG.credentials.google){
        this.cloudConnections['google'] = new GoogleConnection({
            clientId: CLOUD_INTEGRATION_CONFIG.credentials.google.GOOGLE_CLIENT_ID,
            apiKey: CLOUD_INTEGRATION_CONFIG.credentials.google.GOOGLE_API_KEY
        });
    }
}

// @override
var originalCreateControlbar = IDE_Morph.prototype.createControlBar;
IDE_Morph.prototype.createControlBar = function(){
    if(CLOUD_INTEGRATION_CONFIG.settings.DISABLE_SNAP_CLOUD){
        this.cloud.disable();
    }
    originalCreateControlbar.call(this);
}

// @override
ProjectDialogMorph.prototype.buildContents = function () {
    var thumbnail, notification;

    this.addBody(new Morph());
    this.body.color = this.color;

    this.srcBar = new AlignmentMorph('column', this.padding / 2);

    if (this.ide.cloudMsg) {
        notification = new TextMorph(
            this.ide.cloudMsg,
            10,
            null, // style
            false, // bold
            null, // italic
            null, // alignment
            null, // width
            null, // font name
            new Point(1, 1), // shadow offset
            WHITE // shadowColor
        );
        notification.refresh = nop;
        this.srcBar.add(notification);
    }


    if (!this.ide.cloud.disabled) {
        this.addSourceButton('cloud', localize('Cloud'), 'cloud');
    }

    // @new
    for(let connection in this.ide.cloudConnections){
        if(this.ide.cloudConnections.hasOwnProperty(connection)){
            this.addSourceButton('cloud-integration:'+connection, localize(this.ide.cloudConnections[connection].label), 'cloud');
        }
    }


    if (this.task === 'open') {
        this.buildFilterField();
        this.addSourceButton('examples', localize('Examples'), 'poster');
        if (this.hasLocalProjects() || this.ide.world().currentKey === 16) {
            // shift- clicked
            this.addSourceButton('local', localize('Browser'), 'globe');
        }
    }
    this.addSourceButton('disk', localize('Computer'), 'storage');

    this.srcBar.fixLayout();
    this.body.add(this.srcBar);

    if (this.task === 'save') {
        this.nameField = new InputFieldMorph(this.ide.projectName);
        this.body.add(this.nameField);
    }

    this.listField = new ListMorph([]);
    this.fixListFieldItemColors();
    this.listField.fixLayout = nop;
    this.listField.edge = InputFieldMorph.prototype.edge;
    this.listField.fontSize = InputFieldMorph.prototype.fontSize;
    this.listField.typeInPadding = InputFieldMorph.prototype.typeInPadding;
    this.listField.contrast = InputFieldMorph.prototype.contrast;
    this.listField.render = InputFieldMorph.prototype.render;
    this.listField.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;

    this.body.add(this.listField);

    this.preview = new Morph();
    this.preview.fixLayout = nop;
    this.preview.edge = InputFieldMorph.prototype.edge;
    this.preview.fontSize = InputFieldMorph.prototype.fontSize;
    this.preview.typeInPadding = InputFieldMorph.prototype.typeInPadding;
    this.preview.contrast = InputFieldMorph.prototype.contrast;
    this.preview.render = function (ctx) {
        InputFieldMorph.prototype.render.call(this, ctx);
        if (this.cachedTexture) {
            this.renderCachedTexture(ctx);
        } else if (this.texture) {
            this.renderTexture(this.texture, ctx);
        }
    };
    this.preview.renderCachedTexture = function (ctx) {
        ctx.drawImage(this.cachedTexture, this.edge, this.edge);
    };
    this.preview.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;
    this.preview.setExtent(
        this.ide.serializer.thumbnailSize.add(this.preview.edge * 2)
    );

    this.body.add(this.preview);
    if (this.task === 'save') {
        thumbnail = this.ide.stage.thumbnail(
            SnapSerializer.prototype.thumbnailSize
        );
        this.preview.texture = null;
        this.preview.cachedTexture = thumbnail;
        this.preview.rerender();
    }

    this.notesField = new ScrollFrameMorph();
    this.notesField.fixLayout = nop;

    this.notesField.edge = InputFieldMorph.prototype.edge;
    this.notesField.fontSize = InputFieldMorph.prototype.fontSize;
    this.notesField.typeInPadding = InputFieldMorph.prototype.typeInPadding;
    this.notesField.contrast = InputFieldMorph.prototype.contrast;
    this.notesField.render = InputFieldMorph.prototype.render;
    this.notesField.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;

    this.notesField.acceptsDrops = false;
    this.notesField.contents.acceptsDrops = false;

    if (this.task === 'open') {
        this.notesText = new TextMorph('');
    } else { // 'save'
        this.notesText = new TextMorph(this.ide.projectNotes);
        this.notesText.isEditable = true;
        this.notesText.enableSelecting();
    }

    this.notesField.isTextLineWrapping = true;
    this.notesField.padding = 3;
    this.notesField.setContents(this.notesText);
    this.notesField.setWidth(this.preview.width());

    this.body.add(this.notesField);

    if (this.task === 'open') {
        this.addButton('openProject', 'Open');
        this.action = 'openProject';
        this.recoverButton = this.addButton('recoveryDialog', 'Recover', true);
        this.recoverButton.hide();
    } else { // 'save'
        this.addButton('saveProject', 'Save');
        this.action = 'saveProject';
    }
    this.shareButton = this.addButton('shareProject', 'Share', true);
    this.unshareButton = this.addButton('unshareProject', 'Unshare', true);
    this.shareButton.hide();
    this.unshareButton.hide();
    this.publishButton = this.addButton('publishProject', 'Publish', true);
    this.unpublishButton = this.addButton(
        'unpublishProject',
        'Unpublish',
        true
    );
    this.publishButton.hide();
    this.unpublishButton.hide();
    this.deleteButton = this.addButton('deleteProject', 'Delete');
    this.addButton('cancel', 'Cancel');

    // @new - add cloud integration sharing buttons

    // google

    this.googleShareDomainButton = this.addButton('googleShareDomain', 'Share (within domain)', true);
    this.googleShareEveryoneButton = this.addButton('googleShareEveryone', 'Share (anyone with link)', true);
    this.googleUnshareButton = this.addButton('googleUnshare', 'Unshare', true);

    this.googleShareDomainButton.hide();
    this.googleShareEveryoneButton.hide();
    this.googleUnshareButton.hide();

    // end new

    if (notification) {
        this.setExtent(new Point(500, 360).add(notification.extent()));
    } else {
        this.setExtent(new Point(500, 360));
    }
    this.fixLayout();

};

// @new

ProjectDialogMorph.prototype.googleChangeSharing = function(mode){
    var file = this.listField.selected,
    ide = this.ide;

    if(!this.updatingGoogleSharing){
        this.updatingGoogleSharing = true;

        var updateMessage = ide.showMessage('updating sharing...')

        this.ide.cloudConnections['google'].changeSharing(file, mode).then(
            (data)=>{
                updateMessage.destroy();
                ide.showMessage('sharing updated.', 2);
                switch(mode){
                    case 'domain':
                        this.googleShareDomainButton.hide();
                        this.googleUnshareButton.show();
                        this.googleShareEveryoneButton.show();
                        break;
                    case 'anyone':
                        this.googleShareEveryoneButton.hide();
                        this.googleUnshareButton.show();
                        this.googleShareDomainButton.show();
                        break;
                    case 'unshare':
                        this.googleShareDomainButton.show();
                        this.googleShareEveryoneButton.show();
                        this.googleUnshareButton.hide();
                        break;

                }

                this.buttons.fixLayout();
                this.fixLayout();
                this.edit();
                this.updatingGoogleSharing = false;
            },
            (data)=>{
                updateMessage.destroy();

                var message = 'Could not update sharing.\n'+data.result.error.message;

                if(data.result.error.code === 500 && mode ==='domain'){
                    message = 'Your Google account cannot limit sharing \n' +
                        'to just your domain. Try sharing \n' +
                        'with everyone with everyone instead'
                }
                if(data.result.error.code === 403){
                    message = 'Your Google account cannot share \n' +
                        'with everyone. Try sharing just \n' +
                        'within your domain instead.'
                }

                new DialogBoxMorph().inform(
                    'Google Drive',
                    message,
                    this.world(),
                    ide.cloudIcon(null, new Color(180, 0, 0))
                );

                ide.showMessage();
                console.error(data);
                this.updatingGoogleSharing = false;
            }
        )

    }




}

ProjectDialogMorph.prototype.googleShareDomain = function(){
    this.googleChangeSharing('domain');
}

ProjectDialogMorph.prototype.googleShareEveryone = function(){
    this.googleChangeSharing('anyone');
}

ProjectDialogMorph.prototype.googleUnshare = function(){
    this.googleChangeSharing('unshare')
}

// end new

// @override
ProjectDialogMorph.prototype.setSource = function (source) {
    var msg;
    this.source = source;
    this.srcBar.children.forEach(button =>
        button.refresh()
    );

    // @change switch to if

        if(this.source === 'cloud') {
            msg = this.ide.showMessage('Updating\nproject list...');
            this.projectList = [];
            this.ide.cloud.getProjectList(
                response => {
                    // Don't show cloud projects if user has since switched panes.
                    if (this.source === 'cloud') {
                        this.installCloudProjectList(response.projects);
                    }
                    msg.destroy();
                },
                (err, lbl) => {
                    msg.destroy();
                    this.ide.cloudError().call(null, err, lbl);
                }
            );

            return;
        }
        // @new
        else if (this.source && this.source.indexOf('cloud-integration') > -1 ) {
            var cloudConnection = this.ide.cloudConnections[this.source.split(':')[1]];
            if (!cloudConnection.signedIn) {
                cloudConnection.showSignIn(this.ide).then(() => {
                    this.setSource(source);
                });
            } else {
                msg = this.ide.showMessage('Loading project list\nfrom ' + cloudConnection.label + '...');
                cloudConnection.getSnapFiles().then(
                    (files) => {
                        this.projectList = files.sort((a, b) => {
                            return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
                        });
                    }).finally(() => {
                    this.renderList();
                    msg.destroy();
                });
                return;
            }
        } else if(this.source === 'examples'){
            this.projectList = this.getExamplesProjectList();
        } else if(this.source === 'local') {
            // deprecated, only for reading
            this.projectList = this.getLocalProjectList();
        } else if (this.source === 'disk'){
            if (this.task === 'save') {
                this.projectList = [];
            } else {
                this.destroy();
                this.ide.importLocalFile();
                return;
            }
        }


    // @refactored
    this.renderList();
};



// @refactored from ProjectDialogMorph.prototype.setSource
// @override as well
ProjectDialogMorph.prototype.renderList = function(){
    this.listField.destroy();
    this.listField = new ListMorph(
        this.projectList,
        this.projectList.length > 0 ?
            (element) => {return element.name || element; }
            : null,
        null,
        () => this.ok()
    );
    if (this.source === 'disk') {
        this.listField.hide();
    }

    this.fixListFieldItemColors();
    this.listField.fixLayout = nop;
    this.listField.edge = InputFieldMorph.prototype.edge;
    this.listField.fontSize = InputFieldMorph.prototype.fontSize;
    this.listField.typeInPadding = InputFieldMorph.prototype.typeInPadding;
    this.listField.contrast = InputFieldMorph.prototype.contrast;
    this.listField.render = InputFieldMorph.prototype.render;
    this.listField.drawRectBorder = InputFieldMorph.prototype.drawRectBorder;

    if (this.source === 'local') {
        this.listField.action = (item) => {
            var src, xml;
            if (item === undefined) {
                return;
            }
            if (this.nameField) {
                this.nameField.setContents(item.name || '');
            }
            if (this.task === 'open') {
                src = localStorage['-snap-project-' + item.name];
                if (src) {
                    xml = this.ide.serializer.parse(src);
                    this.notesText.text =
                        xml.childNamed('notes').contents || '';
                    this.notesText.rerender();
                    this.notesField.contents.adjustBounds();
                    this.preview.texture =
                        xml.childNamed('thumbnail').contents || null;
                    this.preview.cachedTexture = null;
                    this.preview.rerender();
                }
            }
            this.edit();
        };
    }
    // @new
    else if (this.source && this.source.indexOf('cloud-integration')>-1) {
        var cloudConnectionType = this.source.split(':')[1];
        var cloudConnection = this.ide.cloudConnections[cloudConnectionType];
        this.listField.action = (item) => {
            var src, xml;
            if (item === undefined) {return; }

            if (this.nameField) {
                this.nameField.setContents(item.name || '');
            }
            if(cloudConnectionType === 'google'){

                this.googleUnshareButton.show();
                this.googleShareEveryoneButton.show();
                this.googleShareDomainButton.show();
                if(item.canShare){
                    switch(item.currentPublicPermissionType){
                        case 'domain':
                            this.googleShareDomainButton.hide();
                            break;
                        case 'anyone':
                            this.googleShareEveryoneButton.hide();
                            break;
                        default:
                            this.googleUnshareButton.hide();
                    }
                }

                this.buttons.fixLayout();
                this.fixLayout();
                this.edit();

            }

            cloudConnection.downloadFile(item.id).then((src)=>{
                xml = this.ide.serializer.parse(src);
                this.notesText.text = xml.childNamed('notes').contents || '';
                this.notesText.rerender();
                this.notesField.contents.adjustBounds();
                this.preview.texture = xml.childNamed('thumbnail').contents || null;
                this.preview.cachedTexture = null;
                this.preview.rerender();
                this.edit();

                new SpeechBubbleMorph(new TextMorph(
                    localize('last changed') + '\n' + item.lastupdated,
                    null,
                    null,
                    null,
                    null,
                    'center'
                )).popUp(
                    this.world(),
                    this.preview.rightCenter().add(new Point(2, 0))
                );
            });

        };
    } else { // 'examples'; 'cloud' is initialized elsewhere
        this.listField.action = (item) => {
            var src, xml;
            if (item === undefined) {return; }
            if (this.nameField) {
                this.nameField.setContents(item.name || '');
            }
            src = this.ide.getURL(
                this.ide.resourceURL('Examples', item.fileName)
            );
            xml = this.ide.serializer.parse(src);
            this.notesText.text = xml.childNamed('notes').contents || '';
            this.notesText.rerender();
            this.notesField.contents.adjustBounds();
            this.preview.texture = xml.childNamed('thumbnail').contents || null;
            this.preview.cachedTexture = null;
            this.preview.rerender();
            this.edit();
        };
    }
    this.body.add(this.listField);
    this.shareButton.hide();
    this.unshareButton.hide();

    // @new
    this.googleUnshareButton.hide();
    this.googleShareEveryoneButton.hide();
    this.googleShareDomainButton.hide();

    if (this.task === 'open') {
        this.recoverButton.hide();
    }

    this.publishButton.hide();
    this.unpublishButton.hide();
    if (this.source === 'local') {
        this.deleteButton.show();
    } else { // examples
        this.deleteButton.hide();
    }
    this.buttons.fixLayout();
    this.fixLayout();
    if (this.task === 'open') {
        this.clearDetails();
    }
}

ProjectDialogMorph.prototype.openCloudIntegrationProject = function (proj) {
    var cloudConnectionKey = this.source.split(':')[1];
    var cloudConnection = this.ide.cloudConnections[cloudConnectionKey];
    this.ide.backup(
        () => {
            this.ide.nextSteps([
                () => this.rawOpenCloudIntegrationProject(proj)
            ]);
        },
        'Replace the current project with a new one?',
        'New Project'
    );

}

ProjectDialogMorph.prototype.rawOpenCloudIntegrationProject = function (proj) {
    var cloudConnectionKey = this.source.split(':')[1];
    var cloudConnection = this.ide.cloudConnections[cloudConnectionKey];
    var msg = this.ide.showMessage('Fetching project\nfrom '+cloudConnection.label);
    cloudConnection.downloadFile(proj.id).then((src)=>{
        location.hash = '';
        location.hash = '#cloud-integration-present:Source=' +
            encodeURIComponent(cloudConnectionKey) +
            '&ProjectId=' +
            encodeURIComponent(proj.id);

        cloudConnection.file = proj;
        this.ide.nextSteps([
            () => msg = this.ide.showMessage('Opening project...'),
            () => {
                this.ide.rawOpenProjectString(src);
            },
            () => this.ide.setProjectName(proj.name)
        ]);
    }, (e)=>{
        console.error(e);
        msg.destroy();
        msg = this.ide.showMessage('Error retrieving project\nfrom '+cloudConnection.label);
    });
}


// @override
ProjectDialogMorph.prototype.openProject = function () {
    var proj = this.listField.selected,
        src;
    if (!proj) {return; }
    this.ide.source = this.source;
    if (this.source === 'cloud') {
        this.openCloudProject(proj);
    } else if (this.source === 'examples') {
        // Note "file" is a property of the parseResourceFile function.
        src = this.ide.getURL(this.ide.resourceURL('Examples', proj.fileName));
        this.ide.openProjectString(src);
        this.ide.backup(
            () => this.ide.openProjectString(src),
            'Replace the current project with a new one?',
            'New Project'
        );
        this.destroy();
        // @new
    } else if (this.source.indexOf('cloud-integration')>-1){
        this.openCloudIntegrationProject(proj)
    } else { // 'local'
        this.ide.source = null;
        this.ide.openProject(proj.name);
        this.ide.backup(
            () => this.ide.openProject(proj.name),
            'Replace the current project with a new one?',
            'New Project'
        );
        this.destroy();
    }
};

// @override
ProjectDialogMorph.prototype.saveProject = function () {
    var name = this.nameField.contents().text.text,
        notes = this.notesText.text;


    this.ide.projectNotes = notes || this.ide.projectNotes;
    if (name) {
        if (this.source === 'cloud') {
            if (detect(
                this.projectList,
                item => item.projectname === name
            )) {
                this.ide.confirm(
                    localize(
                        'Are you sure you want to replace'
                    ) + '\n"' + name + '"?',
                    'Replace Project',
                    () => {
                        this.ide.setProjectName(name);
                        this.saveCloudProject();
                    }
                );
            } else {
                this.ide.setProjectName(name);
                this.saveCloudProject();
            }
        // @new
        } else if (this.source && this.source.indexOf('cloud-integration')>-1) {
            this.ide.source = this.source;
            if(detect(
                this.projectList,
                item => item.name === name
            )){
                this.ide.confirm(
                    localize(
                        'Are you sure you want to replace'
                    ) + '\n"' + name + '"?',
                    'Replace Project',
                    () => {
                        this.ide.setProjectName(name);
                        this.saveCloudIntegrationProject();
                    }
                );
            } else {
                this.ide.setProjectName(name);
                this.saveCloudIntegrationProject();
            }

        } else if (this.source === 'disk') {
            this.ide.exportProject(name, false);
            this.ide.source = 'disk';
            this.destroy();
        }
    }
};


// @override
IDE_Morph.prototype.save = function () {
    // temporary hack - only allow exporting projects to disk
    // when running Snap! locally without a web server
    if (location.protocol === 'file:') {
        if (this.projectName) {
            this.exportProject(this.projectName, false);
        } else {
            this.prompt(
                'Export Project As...',
                name => this.exportProject(name, false),
                null,
                'exportProject'
            );
        }
        return;
    }

    if (this.source === 'examples' || this.source === 'local') {
        // cannot save to examples, deprecated localStorage
        this.source = null;
    }
    if (this.projectName) {
        if (this.source === 'disk') {
            this.exportProject(this.projectName);
        } else if (this.source === 'cloud') {
            this.saveProjectToCloud(this.projectName);
            // @new
        } else if (this.source.indexOf('cloud-integration')>-1) {
            this.saveProjectToCloudConnection(this.projectName);
        } else {
            this.saveProjectsBrowser();
        }
    } else {
        this.saveProjectsBrowser();
    }
};
