<?php
/**
 * Events handlers of API operations.
 *
 * @license     MIT License
 * @author      Pavel Solomienko <https://github.com/servocoder/>
 * @copyright   Authors
 */

/**
 * Event listener on after "readfolder" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterFolderReadEvent $event
 */
function fm_event_api_after_folder_read($event)
{
    $data = $event->getFolderData();
    $list = $event->getFolderContent();
}

/**
 * Event listener on after "seekfolder" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterFolderSeekEvent $event
 */
function fm_event_api_after_folder_seek($event)
{
    $data = $event->getFolderData();
    $list = $event->getSearchResult();
    $string = $event->getSearchString();
}

/**
 * Event listener on after "addfolder" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterFolderCreateEvent $event
 */
function fm_event_api_after_folder_create($event)
{
    $data = $event->getFolderData();
}

/**
 * Event listener on after "upload" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterFileUploadEvent $event
 */
function fm_event_api_after_file_upload($event)
{
    $data = $event->getUploadedFileData();
}

/**
 * Event listener on after "extract" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterFileExtractEvent $event
 */
function fm_event_api_after_file_extract($event)
{
    $data = $event->getArchiveData();
    $list = $event->getArchiveContent();
}

/**
 * Event listener on after "rename" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterItemRenameEvent $event
 */
function fm_event_api_after_item_rename($event)
{
    $data = $event->getItemData();
    $originalData = $event->getOriginalItemData();
}

/**
 * Event listener on after "copy" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterItemCopyEvent $event
 */
function fm_event_api_after_item_copy($event)
{
    $data = $event->getItemData();
    $originalData = $event->getOriginalItemData();
}

/**
 * Event listener on after "move" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterItemMoveEvent $event
 */
function fm_event_api_after_item_move($event)
{
    $data = $event->getItemData();
    $originalData = $event->getOriginalItemData();
}

/**
 * Event listener on after "delete" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterItemDeleteEvent $event
 */
function fm_event_api_after_item_delete($event)
{
    $data = $event->getOriginalItemData();
}

/**
 * Event listener on after "download" API method successfully executed.
 *
 * @param \RFM\Event\Api\AfterItemDownloadEvent $event
 */
function fm_event_api_after_item_download($event)
{
    $data = $event->getDownloadedItemData();
}