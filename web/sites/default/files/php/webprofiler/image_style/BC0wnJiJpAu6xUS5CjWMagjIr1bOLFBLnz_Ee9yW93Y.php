<?php

/**
 * This file is auto-generated.
 */

namespace Drupal\webprofiler\Entity;

class ImageStyleStorageDecorator extends ConfigEntityStorageDecorator implements \Drupal\image\ImageStyleStorageInterface
{
    public function setReplacementId($name, $replacement)
    {
        return $this->getOriginalObject()->setReplacementId($name, $replacement);
    }

    public function getReplacementId($name)
    {
        return $this->getOriginalObject()->getReplacementId($name);
    }

    public function clearReplacementId($name)
    {
        return $this->getOriginalObject()->clearReplacementId($name);
    }
}
