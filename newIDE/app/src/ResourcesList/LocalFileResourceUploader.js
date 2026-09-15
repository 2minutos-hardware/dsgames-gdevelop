// @flow
// DSGAMES: replacement for FileToCloudProjectResourceUploader.js — that
// component always uploads to GDevelop's own cloud (requires an account and
// the 'Cloud' storage provider), which our fork never uses (projects are
// always local-only, no GDevelop account). This reads the file directly in
// the browser and embeds it as a data: URI on the resource, so nothing is
// ever uploaded anywhere and no account is needed. The export pipeline
// already resolves resource files with fetch(), which natively supports
// data: URIs, so no changes were needed there.
import { Trans } from '@lingui/macro';
import * as React from 'react';
import path from 'path-browserify';
import { type ChooseResourceOptions } from './ResourceSource';
import {
  getAcceptedExtensions,
  usesFilePseudoMime,
  getInputAcceptedMimesAndExtensions,
} from './FileToCloudProjectResourceUploader';
import AlertMessage from '../UI/AlertMessage';
import { ColumnStackLayout, LineStackLayout } from '../UI/Layout';
import { Line, Column } from '../UI/Grid';
import LinearProgress from '../UI/LinearProgress';
import Paper from '../UI/Paper';
import GDevelopThemeContext from '../UI/Theme/GDevelopThemeContext';
import RaisedButton from '../UI/RaisedButton';

type LocalFileResourceUploaderProps = {|
  options: ChooseResourceOptions,
  onChooseResources: (resources: Array<gdResource>) => void,
  createNewResource: () => gdResource,
  automaticallyOpenInput: boolean,
|};

// data: URIs inflate size by ~33% (base64) and the whole project state
// (including this) lives in memory/localStorage in the browser — keep
// individual files reasonably small.
const LOCAL_FILE_MAX_SIZE_IN_BYTES = 15 * 1000 * 1000;

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read "${file.name}" as a data URL.`));
    };
    reader.onerror = () => {
      reject(reader.error || new Error(`Could not read "${file.name}".`));
    };
    reader.readAsDataURL(file);
  });
};

export const LocalFileResourceUploader = ({
  options,
  onChooseResources,
  createNewResource,
  automaticallyOpenInput,
}: LocalFileResourceUploaderProps): React.Node => {
  const inputRef = React.useRef<?HTMLInputElement>(null);
  const hasAutomaticallyOpenedInput = React.useRef(false);
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const [error, setError] = React.useState<?Error>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [filteredOutFiles, setFilteredOutFiles] = React.useState<File[]>([]);
  const hasSelectedFiles = selectedFiles.length > 0;
  const [readProgress, setReadProgress] = React.useState(0);

  const invalidFiles = selectedFiles
    .map(file => {
      if (file.size > LOCAL_FILE_MAX_SIZE_IN_BYTES) {
        return { filename: file.name, error: 'too-large' };
      }
      return null;
    })
    .filter(Boolean);

  const canChooseFiles = !isReading;

  const onRead = React.useCallback(
    async () => {
      const input = inputRef.current;
      if (!input) return;

      try {
        setIsReading(true);
        setError(null);
        setReadProgress(0);

        const newResources = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const dataUrl = await readFileAsDataUrl(file);
          const newResource = createNewResource();
          newResource.setFile(dataUrl);
          newResource.setName(file.name);
          newResource.setOrigin('local-file', file.name);
          newResources.push(newResource);
          setReadProgress(((i + 1) / selectedFiles.length) * 100);
        }

        if (newResources.length) onChooseResources(newResources);
      } catch (error) {
        setError(error);
      } finally {
        setIsReading(false);
      }
    },
    [selectedFiles, onChooseResources, createNewResource]
  );

  // Automatically open the input once, at the first render, if asked.
  React.useLayoutEffect(
    () => {
      if (automaticallyOpenInput && !hasAutomaticallyOpenedInput.current) {
        hasAutomaticallyOpenedInput.current = true;
        if (inputRef.current) inputRef.current.click();
      }
    },
    [automaticallyOpenInput]
  );

  // Start reading after choosing some files (if there are no errors and
  // if no error happened during the last attempt).
  const canReadFiles =
    !isReading &&
    canChooseFiles &&
    hasSelectedFiles &&
    invalidFiles.length === 0;
  React.useEffect(
    () => {
      if (canReadFiles && !error) {
        onRead();
      }
    },
    [canReadFiles, onRead, error]
  );

  const shouldValidateFilePostPicking = React.useMemo(
    () => usesFilePseudoMime(options.resourceKind),
    [options.resourceKind]
  );

  const validateFilePostPicking = React.useCallback(
    (file: File) => {
      const acceptedExtensions = getAcceptedExtensions(
        options.resourceKind,
        false
      );
      return acceptedExtensions.includes(
        path.extname(file.name).replace(/^\./, '')
      );
    },
    [options.resourceKind]
  );

  return (
    <ColumnStackLayout noMargin>
      <Paper variant="outlined" background="medium">
        <Line expand>
          <Column expand>
            <input
              accept={getInputAcceptedMimesAndExtensions(options.resourceKind)}
              style={{
                color: gdevelopTheme.text.color.primary,
              }}
              multiple={options.multiSelection}
              type="file"
              ref={inputRef}
              disabled={!canChooseFiles}
              onChange={event => {
                const files = [];
                const newFilteredOutFiles = [];
                for (let i = 0; i < event.currentTarget.files.length; i++) {
                  const selectedFile = event.currentTarget.files[i];
                  if (
                    !shouldValidateFilePostPicking ||
                    validateFilePostPicking(selectedFile)
                  ) {
                    files.push(selectedFile);
                  } else {
                    newFilteredOutFiles.push(selectedFile);
                  }
                }
                setFilteredOutFiles(newFilteredOutFiles);
                setSelectedFiles(files);

                // Remove the previous error, if any, to let a new attempt be triggered.
                setError(null);
              }}
            />
            {filteredOutFiles.length > 0 && (
              <AlertMessage kind="warning">
                <Trans>
                  The following file(s) cannot be used for this kind of object:{' '}
                  {filteredOutFiles.map(file => file.name).join(', ')}
                </Trans>
              </AlertMessage>
            )}
          </Column>
        </Line>
      </Paper>
      {invalidFiles.map(erroredFile => {
        if (erroredFile.error === 'too-large')
          return (
            <AlertMessage kind="error" key={erroredFile.filename}>
              <Trans>
                The file {erroredFile.filename} is too large. Use files that are
                smaller for your game: each must be less than{' '}
                {LOCAL_FILE_MAX_SIZE_IN_BYTES / 1000 / 1000} MB.
              </Trans>
            </AlertMessage>
          );

        return (
          <AlertMessage kind="error" key={erroredFile.filename}>
            <Trans>The file {erroredFile.filename} is invalid.</Trans>
          </AlertMessage>
        );
      })}
      {error && (
        <AlertMessage kind="error">
          <Trans>
            There was an error while reading some file(s). Please try again.
          </Trans>
        </AlertMessage>
      )}
      <LineStackLayout alignItems="center" justifyContent="stretch" expand>
        {isReading ? (
          <LinearProgress value={readProgress} variant="determinate" />
        ) : null}
      </LineStackLayout>
      {error && (
        <Line noMargin expand justifyContent="flex-end">
          <RaisedButton primary label={<Trans>Retry</Trans>} onClick={onRead} />
        </Line>
      )}
    </ColumnStackLayout>
  );
};
