<?php

/**
 * This file is auto-generated.
 */

namespace Drupal\webprofiler\Entity;

class ShortcutSetStorageDecorator extends ConfigEntityStorageDecorator implements \Drupal\shortcut\ShortcutSetStorageInterface
{
    public function assignUser($shortcut_set, $account)
    {
        return $this->getOriginalObject()->assignUser($shortcut_set, $account);
    }

    public function unassignUser($account)
    {
        return $this->getOriginalObject()->unassignUser($account);
    }

    public function deleteAssignedShortcutSets($entity)
    {
        return $this->getOriginalObject()->deleteAssignedShortcutSets($entity);
    }

    public function getAssignedToUser($account)
    {
        return $this->getOriginalObject()->getAssignedToUser($account);
    }

    public function countAssignedUsers($shortcut_set)
    {
        return $this->getOriginalObject()->countAssignedUsers($shortcut_set);
    }

    public function getDefaultSet($account)
    {
        return $this->getOriginalObject()->getDefaultSet($account);
    }
}
