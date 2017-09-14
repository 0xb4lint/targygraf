<?php

namespace App;

class University extends Model
{
    public $timestamps = false;
    protected $table = 'universities';

    public function faculties()
    {
        return $this->hasMany(Faculty::class)
            ->orderBy('ordering');
    }

    public function getRouteKeyName()
    {
        return 'slug';
    }
}
