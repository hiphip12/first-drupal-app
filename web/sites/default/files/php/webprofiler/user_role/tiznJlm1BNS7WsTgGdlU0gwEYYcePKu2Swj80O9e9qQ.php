<?php

/**
 * This file is auto-generated.
 */

namespace Drupal\webprofiler\Entity;

class RoleStorageDecorator extends ConfigEntityStorageDecorator implements \Drupal\user\RoleStorageInterface
{
    public function isPermissionInRoles($permission, $rids)
    {
        return $this->getOriginalObject()->isPermissionInRoles($permission, $rids);
    }
}
