<?php

/**
 * This file is auto-generated.
 */

namespace Drupal\webprofiler\Entity;

class VocabularyStorageDecorator extends ConfigEntityStorageDecorator implements \Drupal\taxonomy\VocabularyStorageInterface
{
    public function getToplevelTids($vids)
    {
        return $this->getOriginalObject()->getToplevelTids($vids);
    }
}
