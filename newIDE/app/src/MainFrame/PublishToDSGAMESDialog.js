// @flow
import { Trans } from '@lingui/macro';
import * as React from 'react';
import Dialog from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import RaisedButton from '../UI/RaisedButton';
import Text from '../UI/Text';
import TextField from '../UI/TextField';
import { ColumnStackLayout } from '../UI/Layout';
import { browserHTML5ExportPipeline } from '../ExportAndShare/BrowserExporters/BrowserHTML5Export';
import { serializeToJSON } from '../Utils/Serializer';

type Props = {|
  project: gdProject,
  onClose: () => void,
|};

// DSGAMES: when the editor was opened from a game's "Edit" page (see
// game_edit.html's "Open in the GDevelop editor" link), the URL carries
// which existing game this session is editing - read once, not expected to
// change during the lifetime of this component/tab.
const editUrlParams = new URLSearchParams(window.location.search);
const editSlug = editUrlParams.get('editSlug');
// The reopened project's own internal name (project.getName()) is a
// separate GDevelop property, never kept in sync with the DSGAMES title -
// prefill from this instead so "Update" doesn't silently rename the game
// to whatever the project happens to be internally called.
const editTitle = editUrlParams.get('editTitle');

type PublishState =
  | {| status: 'form' |}
  | {| status: 'not-logged-in' |}
  | {| status: 'publishing' |}
  | {| status: 'success' |}
  | {| status: 'error', message: string |};

const readCsrfToken = (): string => {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const PublishToDSGAMESDialog = ({ project, onClose }: Props): React.Node => {
  const [title, setTitle] = React.useState<string>(
    editTitle || (project ? project.getName() : '')
  );
  const [description, setDescription] = React.useState<string>('');
  const [state, setState] = React.useState<PublishState>({ status: 'form' });

  const targetUrl = editSlug ? `/${editSlug}/edit/` : '/publish/';

  const publish = async () => {
    setState({ status: 'publishing' });
    try {
      // Check login state and let Django set the csrftoken cookie for us
      // (both /publish/ and /<slug>/edit/ render {% csrf_token %}).
      const checkResponse = await fetch(targetUrl, {
        credentials: 'include',
      });
      if (
        checkResponse.redirected &&
        checkResponse.url.includes('/accounts/login/')
      ) {
        setState({ status: 'not-logged-in' });
        return;
      }

      const context = {
        project,
        exportState: null,
        updateStepProgress: () => {},
        i18n: { _: (message: any) => message },
      };
      const prepared = await browserHTML5ExportPipeline.prepareExporter(
        context
      );
      const exportOutput = await browserHTML5ExportPipeline.launchExport(
        context,
        prepared,
        null
      );
      const resourcesOutput = await browserHTML5ExportPipeline.launchResourcesDownload(
        context,
        exportOutput
      );
      const zipBlob = await browserHTML5ExportPipeline.launchCompression(
        context,
        resourcesOutput
      );

      // The raw project (not just the exported build) so a later "Edit" can
      // reload it into the editor instead of only accepting a .zip re-upload.
      const projectJsonBlob = new Blob([serializeToJSON(project)], {
        type: 'application/json',
      });

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('game_zip', zipBlob, 'game.zip');
      formData.append('project_json', projectJsonBlob, 'project.json');

      const csrftoken = readCsrfToken();
      const publishResponse = await fetch(targetUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
        body: formData,
      });

      if (
        publishResponse.redirected &&
        !publishResponse.url.includes(targetUrl)
      ) {
        setState({ status: 'success' });
      } else {
        setState({
          status: 'error',
          message: editSlug
            ? 'Something went wrong updating the game. You can still export it manually (File > Export) and upload the .zip on DSGAMES.'
            : 'Something went wrong publishing the game. You can still export it manually (File > Export) and upload the .zip on DSGAMES.',
        });
      }
    } catch (error) {
      console.error('[DSGAMES] Publish to DSGAMES failed:', error);
      setState({
        status: 'error',
        message: editSlug
          ? 'Something went wrong updating the game. You can still export it manually (File > Export) and upload the .zip on DSGAMES.'
          : 'Something went wrong publishing the game. You can still export it manually (File > Export) and upload the .zip on DSGAMES.',
      });
    }
  };

  const isPublishing = state.status === 'publishing';

  return (
    <Dialog
      title={
        editSlug ? (
          <Trans>Update on DSGAMES</Trans>
        ) : (
          <Trans>Publish to DSGAMES</Trans>
        )
      }
      open
      onRequestClose={isPublishing ? () => {} : onClose}
      maxWidth="sm"
      actions={
        state.status === 'success'
          ? [
              <FlatButton
                key="close"
                label={<Trans>Close</Trans>}
                onClick={onClose}
              />,
            ]
          : [
              <FlatButton
                key="cancel"
                label={<Trans>Cancel</Trans>}
                disabled={isPublishing}
                onClick={onClose}
              />,
              <RaisedButton
                key="publish"
                primary
                label={
                  editSlug ? <Trans>Update</Trans> : <Trans>Publish</Trans>
                }
                disabled={isPublishing || !title.trim()}
                onClick={publish}
              />,
            ]
      }
    >
      {state.status === 'not-logged-in' ? (
        <Text>
          <Trans>
            You need to be logged in on DSGAMES to publish. Open{' '}
            <a
              href="/accounts/login/"
              target="_blank"
              rel="noopener noreferrer"
            >
              the login page
            </a>{' '}
            in a new tab, then try again.
          </Trans>
        </Text>
      ) : state.status === 'success' ? (
        <Text>
          {editSlug ? (
            <Trans>
              Updated! It'll appear in the DSGAMES catalog once it's reviewed
              again.
            </Trans>
          ) : (
            <Trans>
              Published! It'll appear in the DSGAMES catalog once it's reviewed.
            </Trans>
          )}
        </Text>
      ) : state.status === 'error' ? (
        <Text>{state.message}</Text>
      ) : (
        <ColumnStackLayout noMargin>
          <TextField
            fullWidth
            floatingLabelText={<Trans>Title</Trans>}
            value={title}
            onChange={(e, value) => setTitle(value)}
            disabled={isPublishing}
          />
          <TextField
            fullWidth
            multiline
            floatingLabelText={<Trans>Description (optional)</Trans>}
            value={description}
            onChange={(e, value) => setDescription(value)}
            disabled={isPublishing}
          />
          {isPublishing && (
            <Text>
              <Trans>
                Exporting and publishing your game, this can take a few seconds…
              </Trans>
            </Text>
          )}
        </ColumnStackLayout>
      )}
    </Dialog>
  );
};

export default PublishToDSGAMESDialog;
