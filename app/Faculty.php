<?php

namespace App;

class Faculty extends Model
{
    public $timestamps = false;
    protected $table = 'faculties';

    public function programs()
    {
        return $this->hasMany(Program::class)
            ->orderBy('name');
    }
}
